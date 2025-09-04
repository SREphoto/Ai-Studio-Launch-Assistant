import { GoogleGenAI } from "@google/genai";

// --- AI Launchpad Types ---
export type CardType = 'step' | 'decision' | 'option-best' | 'option-other' | 'warning';
export type AppView = 'launchpad' | 'guide';

export interface SubStep {
  id: string;
  instruction: string;
  completed: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

export interface DetailedCardData {
  id: string;
  title: string;
  type: CardType;
  content: string;
  completed: boolean;
  decisionContextId?: string;
  activatedByOptionId?: string;
  subSteps?: SubStep[];
  isBreakingDown?: boolean;
  breakdownError?: string | null;
  chatHistory?: ChatMessage[];
  isChatLoading?: boolean;
  chatError?: string | null;
  currentChatQuery?: string;
  isExpanded?: boolean;
}

export interface RoadmapStep {
  id: string;
  title: string;
  type: CardType;
  completed: boolean;
  relatedCardId: string;
  isArchived?: boolean;
  activatedByOptionId?: string;
}

export interface ApplicationState {
    projectDescription: string;
    roadmapSteps: RoadmapStep[];
    detailedCards: DetailedCardData[];
    completedDetailedCards: DetailedCardData[];
    archivedCards: DetailedCardData[];
    selectedOptionForDecision: { [decisionCardId: string]: string | null };
}

// --- State Variables ---

const state = {
    currentView: 'launchpad' as AppView,
    currentProjectDescription: "",
    roadmapSteps: [] as RoadmapStep[],
    detailedCards: [] as DetailedCardData[],
    completedDetailedCards: [] as DetailedCardData[],
    archivedCards: [] as DetailedCardData[],
    selectedOptionForDecision: {} as { [decisionCardId: string]: string | null },
    isLoadingAiResponse: false,
    globalAiError: null as string | null,
    ai: null as GoogleGenAI | null,
};

// --- State Accessors and Mutators ---

export function getAppState(): ApplicationState {
    return {
        projectDescription: state.currentProjectDescription,
        roadmapSteps: state.roadmapSteps,
        detailedCards: state.detailedCards,
        completedDetailedCards: state.completedDetailedCards,
        archivedCards: state.archivedCards,
        selectedOptionForDecision: state.selectedOptionForDecision,
    };
}

export function loadAppState(loadedState: ApplicationState) {
    state.currentProjectDescription = loadedState.projectDescription || "";
    state.roadmapSteps = loadedState.roadmapSteps || [];
    state.detailedCards = loadedState.detailedCards || [];
    state.completedDetailedCards = loadedState.completedDetailedCards || [];
    state.archivedCards = loadedState.archivedCards || [];
    state.selectedOptionForDecision = loadedState.selectedOptionForDecision || {};

    // Sanitize loaded data
    [...state.detailedCards, ...state.completedDetailedCards, ...state.archivedCards].forEach(card => {
        if (card.subSteps === undefined) card.subSteps = [];
        if (card.chatHistory === undefined) card.chatHistory = [];
        if (card.currentChatQuery === undefined) card.currentChatQuery = "";
        if (card.isBreakingDown === undefined) card.isBreakingDown = false;
        if (card.breakdownError === undefined) card.breakdownError = null;
        if (card.isChatLoading === undefined) card.isChatLoading = false;
        if (card.chatError === undefined) card.chatError = null;
        if (card.activatedByOptionId === undefined) card.activatedByOptionId = undefined;
        if (card.isExpanded === undefined) {
            card.isExpanded = !(card.type === 'decision' && state.detailedCards.includes(card));
        }
    });
    state.roadmapSteps.forEach(rs => {
        if(rs.activatedByOptionId === undefined) rs.activatedByOptionId = undefined;
        if(rs.isArchived === undefined) rs.isArchived = false;
    });
}


export const getState = () => state;

export function setCurrentView(view: AppView) {
    state.currentView = view;
}

export function setCurrentProjectDescription(description: string) {
    state.currentProjectDescription = description;
}

export function setRoadmapSteps(steps: RoadmapStep[]) {
    state.roadmapSteps = steps;
}

export function setDetailedCards(cards: DetailedCardData[]) {
    state.detailedCards = cards;
}

export function setCompletedDetailedCards(cards: DetailedCardData[]) {
    state.completedDetailedCards = cards;
}

export function setArchivedCards(cards: DetailedCardData[]) {
    state.archivedCards = cards;
}

export function setSelectedOptionForDecision(decisionId: string, optionId: string | null) {
    state.selectedOptionForDecision[decisionId] = optionId;
}

export function setIsLoadingAiResponse(isLoading: boolean) {
    state.isLoadingAiResponse = isLoading;
}

export function setGlobalAiError(error: string | null) {
    state.globalAiError = error;
}

export function initializeAi() {
    const API_KEY = process.env.API_KEY;
    if (API_KEY) {
        try {
            state.ai = new GoogleGenAI({ apiKey: API_KEY });
        } catch (error) {
            console.error("Failed to initialize GoogleGenAI:", error);
            setGlobalAiError("Failed to initialize AI. API Key might be invalid or not configured correctly.");
        }
    } else {
        console.warn("API_KEY environment variable not found. AI Launchpad functionality will be limited or disabled.");
        setGlobalAiError("AI features require an API_KEY. Please set the API_KEY environment variable. Without it, the AI Launchpad will not function.");
    }
}

export function findCardGlobally(cardId: string): DetailedCardData | undefined {
    return state.detailedCards.find(c => c.id === cardId) ||
           state.completedDetailedCards.find(c => c.id === cardId) ||
           state.archivedCards.find(c => c.id === cardId);
}

export function archiveGivenCard(cardToArchive: DetailedCardData, sourceList: DetailedCardData[] = state.detailedCards) {
    const indexInSource = sourceList.findIndex(c => c.id === cardToArchive.id);
    if (indexInSource > -1) {
        sourceList.splice(indexInSource, 1);
    }
    const indexInCompleted = state.completedDetailedCards.findIndex(c => c.id === cardToArchive.id);
    if (indexInCompleted > -1) {
        state.completedDetailedCards.splice(indexInCompleted, 1);
    }

    if (!state.archivedCards.find(c => c.id === cardToArchive.id)) {
        state.archivedCards.push(cardToArchive);
    }
    const roadmapItem = state.roadmapSteps.find(rs => rs.relatedCardId === cardToArchive.id);
    if (roadmapItem) {
        roadmapItem.isArchived = true;
        roadmapItem.completed = false;
    }
    cardToArchive.completed = false;
}


export function unarchiveGivenCard(cardToUnarchive: DetailedCardData) {
    const index = state.archivedCards.findIndex(c => c.id === cardToUnarchive.id);
    if (index > -1) {
        state.archivedCards.splice(index, 1);
        if (!state.detailedCards.find(c => c.id === cardToUnarchive.id) && !state.completedDetailedCards.find(c => c.id === cardToUnarchive.id)) {
            state.detailedCards.push(cardToUnarchive);
        }
        state.detailedCards.sort((a,b) => {
            const indexA = state.roadmapSteps.findIndex(rs => rs.id === a.id);
            const indexB = state.roadmapSteps.findIndex(rs => rs.id === b.id);
            return indexA - indexB;
        });
        const roadmapItem = state.roadmapSteps.find(rs => rs.relatedCardId === cardToUnarchive.id);
        if (roadmapItem) {
            roadmapItem.isArchived = false;
        }
    }
}
