type CuratedBoundaryValue = CwBoundaryValue;

export type CuratedCardLayout = 'portrait' | 'landscape';

export type CuratedCardController = {
  seriesId: string;
  card: Element;
  contentSignature: string;
  cardLayout: CuratedCardLayout;
  parkedAt: number | null;
};

export type CuratedPanelGridParkingLifecycleHandlers = {
  onParked?: (() => void) | null;
  onUnparked?: (() => void) | null;
  onDisposed?: (() => void) | null;
};

type CuratedPanelGridParkingManagerOptions = {
  maxParkedCardCount?: number;
  maxParkedCardAgeMs?: number;
  now?: () => number;
  isCuratedCardElement: (value: CuratedBoundaryValue) => value is Element;
  getElementDataAttribute: (element: Element, datasetKey: string, attributeName: string) => string;
  parseCardLayoutFromContentSignature: (signature: string) => CuratedCardLayout | null;
  setCardParkedState: (card: Element, parked: boolean) => void;
};

const defaultMaxParkedCardCount = 180;
const adaptiveMaxParkedCardCountCeiling = 720;
const defaultMaxParkedCardAgeMs = 5 * 60_000;

export class CuratedPanelGridParkingManager {
  private readonly cardControllersBySeriesId = new Map<string, CuratedCardController>();
  private parkedCardSeriesOrder: string[] = [];
  private readonly maxParkedCardCount: number;
  private readonly useAdaptiveParkedCardCount: boolean;
  private readonly maxParkedCardAgeMs: number;
  private readonly now: () => number;
  private readonly isCuratedCardElement: (value: CuratedBoundaryValue) => value is Element;
  private readonly getElementDataAttribute: (element: Element, datasetKey: string, attributeName: string) => string;
  private readonly parseCardLayoutFromContentSignature: (signature: string) => CuratedCardLayout | null;
  private readonly setCardParkedState: (card: Element, parked: boolean) => void;

  constructor(options: CuratedPanelGridParkingManagerOptions) {
    this.maxParkedCardCount = options.maxParkedCardCount ?? defaultMaxParkedCardCount;
    this.useAdaptiveParkedCardCount = options.maxParkedCardCount == null;
    this.maxParkedCardAgeMs = options.maxParkedCardAgeMs ?? defaultMaxParkedCardAgeMs;
    this.now = options.now ?? Date.now;
    this.isCuratedCardElement = options.isCuratedCardElement;
    this.getElementDataAttribute = options.getElementDataAttribute;
    this.parseCardLayoutFromContentSignature = options.parseCardLayoutFromContentSignature;
    this.setCardParkedState = options.setCardParkedState;
  }

  getControllerForSeriesId(seriesId: string): CuratedCardController | null {
    if (!seriesId) {
      return null;
    }
    return this.cardControllersBySeriesId.get(seriesId) || null;
  }

  setController(controller: CuratedCardController): void {
    if (!controller.seriesId) {
      return;
    }
    this.cardControllersBySeriesId.set(controller.seriesId, controller);
  }

  markCardControllerActive(seriesId: string, handlers?: CuratedPanelGridParkingLifecycleHandlers): void {
    if (!seriesId) {
      return;
    }
    const controller = this.cardControllersBySeriesId.get(seriesId);
    if (!controller || controller.parkedAt == null) {
      return;
    }
    controller.parkedAt = null;
    this.removeSeriesIdFromParkedOrder(seriesId);
    handlers?.onUnparked?.();
  }

  parkGridCardsForReuse(
    documentRef: Document,
    gridElement: Element,
    handlers?: CuratedPanelGridParkingLifecycleHandlers,
  ): void {
    Array.from(gridElement.children).forEach((child) => {
      if (!this.isCuratedCardElement(child)) {
        return;
      }
      this.parkCardForReuse(documentRef, child, handlers);
    });
  }

  parkUnusedControllersForReuse(
    documentRef: Document,
    visibleSeriesIds: Set<string>,
    retainedSeriesIds: Set<string> = new Set<string>(),
    handlers?: CuratedPanelGridParkingLifecycleHandlers,
  ): void {
    this.cardControllersBySeriesId.forEach((controller, seriesId) => {
      if (visibleSeriesIds.has(seriesId) || retainedSeriesIds.has(seriesId) || controller.parkedAt != null) {
        return;
      }
      this.parkControllerForReuse(documentRef, controller, handlers);
    });
  }

  parkCardForReuse(documentRef: Document, card: Element, handlers?: CuratedPanelGridParkingLifecycleHandlers): void {
    if (!this.isCuratedCardElement(card)) {
      return;
    }

    const seriesId = this.getControllerSeriesIdForCard(card);
    if (!seriesId) {
      return;
    }

    const existingController = this.getControllerForSeriesId(seriesId);
    const controller =
      existingController && existingController.card === card
        ? existingController
        : this.createControllerFromCard(seriesId, card);

    if (!existingController) {
      this.cardControllersBySeriesId.set(seriesId, controller);
    } else if (existingController.card !== card) {
      this.removeCardFromParentNode(card);
      return;
    }

    this.parkControllerForReuse(documentRef, controller, handlers);
  }

  trimParkedCardsForReuse(handlers?: CuratedPanelGridParkingLifecycleHandlers): void {
    const now = this.now();

    this.parkedCardSeriesOrder.slice().forEach((seriesId) => {
      const controller = this.cardControllersBySeriesId.get(seriesId);
      if (!controller || controller.parkedAt == null) {
        this.removeSeriesIdFromParkedOrder(seriesId);
        return;
      }
      if (now - controller.parkedAt <= this.maxParkedCardAgeMs) {
        return;
      }
      this.disposeCardController(seriesId, controller, handlers);
    });

    let parkedCount = this.getParkedControllerCount();
    const allowedParkedCardCount = this.resolveAllowedParkedCardCount();
    while (parkedCount > allowedParkedCardCount) {
      const oldestSeriesId = this.parkedCardSeriesOrder[0] || '';
      if (!oldestSeriesId) {
        break;
      }
      const controller = this.cardControllersBySeriesId.get(oldestSeriesId);
      if (!controller || controller.parkedAt == null) {
        this.removeSeriesIdFromParkedOrder(oldestSeriesId);
        continue;
      }
      this.disposeCardController(oldestSeriesId, controller, handlers);
      parkedCount -= 1;
    }
  }

  dispose(): void {
    this.cardControllersBySeriesId.forEach((controller) => {
      this.removeCardFromParentNode(controller.card);
      controller.parkedAt = null;
    });
    this.cardControllersBySeriesId.clear();
    this.parkedCardSeriesOrder = [];
  }

  private getControllerSeriesIdForCard(card: Element): string {
    return this.getElementDataAttribute(card, 'cwSeriesId', 'data-cw-series-id');
  }

  private removeSeriesIdFromParkedOrder(seriesId: string): void {
    const index = this.parkedCardSeriesOrder.indexOf(seriesId);
    if (index >= 0) {
      this.parkedCardSeriesOrder.splice(index, 1);
    }
  }

  private removeCardFromParentNode(card: Element): void {
    const parentNode = (card as Element & { parentNode?: Element | DocumentFragment | null }).parentNode;
    if (!parentNode || typeof parentNode.removeChild !== 'function') {
      return;
    }
    parentNode.removeChild(card);
  }

  private createControllerFromCard(seriesId: string, card: Element): CuratedCardController {
    const contentSignature = this.getElementDataAttribute(
      card,
      'cwCardContentSignature',
      'data-cw-card-content-signature',
    );
    const cardLayout = this.parseCardLayoutFromContentSignature(contentSignature) || 'portrait';
    return {
      seriesId,
      card,
      contentSignature,
      cardLayout,
      parkedAt: null,
    };
  }

  private getParkedControllerCount(): number {
    let parkedCount = 0;
    this.cardControllersBySeriesId.forEach((controller) => {
      if (controller.parkedAt != null) {
        parkedCount += 1;
      }
    });
    return parkedCount;
  }

  private resolveAllowedParkedCardCount(): number {
    if (!this.useAdaptiveParkedCardCount) {
      return this.maxParkedCardCount;
    }
    return Math.max(
      this.maxParkedCardCount,
      Math.min(adaptiveMaxParkedCardCountCeiling, this.cardControllersBySeriesId.size),
    );
  }

  private disposeCardController(
    seriesId: string,
    controller: CuratedCardController,
    handlers?: CuratedPanelGridParkingLifecycleHandlers,
  ): void {
    this.cardControllersBySeriesId.delete(seriesId);
    this.removeSeriesIdFromParkedOrder(seriesId);
    this.removeCardFromParentNode(controller.card);
    controller.parkedAt = null;
    handlers?.onDisposed?.();
  }

  private parkControllerForReuse(
    _documentRef: Document,
    controller: CuratedCardController,
    handlers?: CuratedPanelGridParkingLifecycleHandlers,
  ): void {
    if (!this.isCuratedCardElement(controller.card)) {
      return;
    }
    if (!controller.seriesId) {
      return;
    }
    if (controller.parkedAt != null) {
      return;
    }

    this.setCardParkedState(controller.card, true);
    controller.parkedAt = this.now();
    this.removeSeriesIdFromParkedOrder(controller.seriesId);
    this.parkedCardSeriesOrder.push(controller.seriesId);
    handlers?.onParked?.();
  }
}
