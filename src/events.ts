import {
    getState,
    setCurrentProjectDescription,
    setGlobalAiError,
    setIsLoadingAiResponse,
    setRoadmapSteps,
    setDetailedCards,
    setCompletedDetailedCards,
    setArchivedCards,
    findCardGlobally,
    setSelectedOptionForDecision,
    archiveGivenCard,
    unarchiveGivenCard,
    loadAppState,
    ApplicationState
} from "./state";
import { generateLaunchPlan, breakDownStep, getInCardChatResponse } from "./api";
import { updateView } from "./ui";
import { generateUniqueId } from "./utils";

export function handleProjectDescriptionSubmit(event: Event) {
    event.preventDefault();
    const { ai } = getState();
    if (!ai) {
        setGlobalAiError("AI client is not initialized. Please ensure API_KEY is set correctly.");
        updateView();
        return;
    }

    const descriptionTextarea = document.getElementById('project-description') as HTMLTextAreaElement;
    const description = descriptionTextarea.value.trim();
    setCurrentProjectDescription(description);

    if (!description) {
        setGlobalAiError("Please describe your project.");
        updateView();
        return;
    }

    setIsLoadingAiResponse(true);
    setGlobalAiError(null);
    updateView();

    generateLaunchPlan(description)
        .then(generatedData => {
            setRoadmapSteps(generatedData.map(item => ({
                id: item.id,
                title: item.title,
                type: item.type,
                completed: false,
                relatedCardId: item.id,
                isArchived: false,
                activatedByOptionId: item.activatedByOptionId
            })));

            setDetailedCards(generatedData.map(item => ({
                ...item,
                id: item.id,
                completed: false,
                subSteps: [],
                chatHistory: [],
                currentChatQuery: '',
                isBreakingDown: false,
                breakdownError: null,
                isChatLoading: false,
                chatError: null,
                isExpanded: item.type !== 'decision',
            })));

            setCompletedDetailedCards([]);
            setArchivedCards([]);
            const { selectedOptionForDecision } = getState();
            for (const key in selectedOptionForDecision) {
                delete selectedOptionForDecision[key];
            }
        })
        .catch(error => {
            console.error("Error generating launch plan with Gemini API:", error);
            setGlobalAiError(`Failed to generate launch plan: ${error.message || 'Unknown error'}. Check console for details. The AI may have returned an invalid format.`);
            setRoadmapSteps([]);
            setDetailedCards([]);
            setCompletedDetailedCards([]);
            setArchivedCards([]);
        })
        .finally(() => {
            setIsLoadingAiResponse(false);
            updateView();
        });
}

export async function handleBreakDownStep(cardId: string) {
    const { ai } = getState();
    if (!ai) return;

    const card = findCardGlobally(cardId);
    if (!card) return;

    card.isBreakingDown = true;
    card.breakdownError = null;
    updateView();

    try {
        const parsedSubSteps = await breakDownStep(card);
        card.subSteps = parsedSubSteps.map((s, index) => ({
            id: `${cardId}-sub-${index}`,
            instruction: s.instruction,
            completed: false,
        }));
    } catch (error)
    {
        console.error(`Error breaking down step for card ${cardId}:`, error);
        card.breakdownError = `Failed to get sub-steps: ${error.message || 'Unknown error'}. The AI may have returned an invalid format.`;
        card.subSteps = [];
    } finally {
        card.isBreakingDown = false;
        updateView();
    }
}

export async function handleInCardChatSubmit(cardId: string, userQuery: string) {
    const { ai } = getState();
    if (!ai || !userQuery.trim()) return;
    const card = findCardGlobally(cardId);
    if (!card) return;

    card.isChatLoading = true;
    card.chatError = null;
    if (!card.chatHistory) card.chatHistory = [];
    card.chatHistory.push({
        id: generateUniqueId(`${cardId}-chat-msg`),
        sender: 'user',
        text: userQuery,
        timestamp: new Date()
    });
    card.currentChatQuery = '';

    updateView();

    try {
        const responseText = await getInCardChatResponse(card, userQuery);
        card.chatHistory.push({
            id: generateUniqueId(`${cardId}-chat-msg`),
            sender: 'ai',
            text: responseText,
            timestamp: new Date()
        });
    } catch (error) {
        console.error(`Error in-card chat for card ${cardId}:`, error);
        card.chatError = `AI response error: ${error.message || 'Unknown error'}`;
        card.chatHistory.push({
            id: generateUniqueId(`${cardId}-chat-msg`),
            sender: 'ai',
            text: `Sorry, I encountered an error: ${error.message || 'Unknown error'}. Please try again.`,
            timestamp: new Date()
        });
    } finally {
        card.isChatLoading = false;
        updateView();
    }
}

export function handleToggleComplete(event: Event) {
    const button = event.target as HTMLButtonElement;
    const cardId = button.dataset.cardId;
    if (!cardId) return;

    const { detailedCards, completedDetailedCards, archivedCards, roadmapSteps } = getState();

    const isMarkingDone = !button.classList.contains('pending-btn');
    let cardToUpdate = findCardGlobally(cardId);
    if (!cardToUpdate) return;

    const originalSourceList = detailedCards.includes(cardToUpdate) ? detailedCards :
                               completedDetailedCards.includes(cardToUpdate) ? completedDetailedCards :
                               undefined;

    if (isMarkingDone) {
        cardToUpdate.completed = true;
        if (originalSourceList === detailedCards) {
            setDetailedCards(detailedCards.filter(c => c.id !== cardId));
            if (!completedDetailedCards.find(c => c.id === cardId)) {
                completedDetailedCards.push(cardToUpdate);
            }
            completedDetailedCards.sort((a,b) => {
                const indexA = roadmapSteps.findIndex(rs => rs.relatedCardId === a.id);
                const indexB = roadmapSteps.findIndex(rs => rs.relatedCardId === b.id);
                return indexA - indexB;
            });
        }

        if (['option-best', 'option-other'].includes(cardToUpdate.type) && cardToUpdate.decisionContextId) {
            const decisionId = cardToUpdate.decisionContextId;
            setSelectedOptionForDecision(decisionId, cardToUpdate.id);

            let decisionCard = findCardGlobally(decisionId);
            if (decisionCard && !decisionCard.completed) {
                decisionCard.completed = true;
                 decisionCard.isExpanded = false;
                if (detailedCards.includes(decisionCard)) {
                    setDetailedCards(detailedCards.filter(c => c.id !== decisionId));
                    if(!completedDetailedCards.find(c => c.id === decisionId)){
                         completedDetailedCards.push(decisionCard);
                    }
                     completedDetailedCards.sort((a,b) => {
                        const indexA = roadmapSteps.findIndex(rs => rs.relatedCardId === a.id);
                        const indexB = roadmapSteps.findIndex(rs => rs.relatedCardId === b.id);
                        return indexA - indexB;
                     });
                }
                const roadmapDecision = roadmapSteps.find(rs => rs.relatedCardId === decisionId);
                if (roadmapDecision) roadmapDecision.completed = true;
            }

            const allRelevantCards = [...detailedCards, ...completedDetailedCards, ...archivedCards];
            allRelevantCards.forEach(currentCard => {
                if (currentCard.id === cardToUpdate!.id || currentCard.id === decisionId) return;

                if (currentCard.decisionContextId === decisionId && currentCard.id !== cardToUpdate!.id) {
                     if (!archivedCards.find(ac => ac.id === currentCard.id)) archiveGivenCard(currentCard);
                }
                else if (currentCard.activatedByOptionId) {
                    const activatingOption = findCardGlobally(currentCard.activatedByOptionId);
                    if (activatingOption && activatingOption.decisionContextId === decisionId && currentCard.activatedByOptionId !== cardToUpdate!.id) {
                         if (!archivedCards.find(ac => ac.id === currentCard.id)) archiveGivenCard(currentCard);
                    }
                }
            });

            [...archivedCards, ...detailedCards].forEach(c => {
                if(c.activatedByOptionId === cardToUpdate!.id) {
                    unarchiveGivenCard(c);
                }
            });

        }
    } else { // Marking as pending
        cardToUpdate.completed = false;
        if (originalSourceList === completedDetailedCards) {
            setCompletedDetailedCards(completedDetailedCards.filter(c => c.id !== cardId));
            if (!detailedCards.find(c => c.id === cardId)) {
                 detailedCards.push(cardToUpdate);
            }
            detailedCards.sort((a, b) => {
                const indexA = roadmapSteps.findIndex(rs => rs.relatedCardId === a.id);
                const indexB = roadmapSteps.findIndex(rs => rs.relatedCardId === b.id);
                return indexA - indexB;
            });
        }

        if (['option-best', 'option-other'].includes(cardToUpdate.type) && cardToUpdate.decisionContextId) {
            const decisionId = cardToUpdate.decisionContextId;
            if (getState().selectedOptionForDecision[decisionId] === cardToUpdate.id) {
                setSelectedOptionForDecision(decisionId, null);

                const decisionCard = findCardGlobally(decisionId);
                if (decisionCard && decisionCard.completed) {
                    decisionCard.completed = false;
                    if (completedDetailedCards.includes(decisionCard)) {
                        setCompletedDetailedCards(completedDetailedCards.filter(c => c.id !== decisionId));
                        if (!detailedCards.find(c => c.id === decisionId)) {
                            detailedCards.push(decisionCard);
                        }
                        detailedCards.sort((a, b) => {
                            const indexA = roadmapSteps.findIndex(rs => rs.relatedCardId === a.id);
                            const indexB = roadmapSteps.findIndex(rs => rs.relatedCardId === b.id);
                            return indexA - indexB;
                        });
                    }
                    const roadmapDecision = roadmapSteps.find(rs => rs.relatedCardId === decisionId);
                    if (roadmapDecision) roadmapDecision.completed = false;
                }

                 const cardsToPotentiallyUnarchive = archivedCards.filter(ac => {
                    if (ac.decisionContextId === decisionId) return true;
                    if (ac.activatedByOptionId) {
                        const activatingOpt = findCardGlobally(ac.activatedByOptionId) || archivedCards.find(arcOpt => arcOpt.id === ac.activatedByOptionId);
                        return activatingOpt && activatingOpt.decisionContextId === decisionId;
                    }
                    return false;
                });
                cardsToPotentiallyUnarchive.forEach(c => unarchiveGivenCard(c));

                 [...detailedCards, ...completedDetailedCards].forEach(c => {
                    if (c.activatedByOptionId === cardToUpdate!.id) {
                        if (!archivedCards.find(ac => ac.id === c.id)) archiveGivenCard(c);
                    }
                });
            }
        }
    }

    const roadmapStepToUpdate = roadmapSteps.find(rs => rs.relatedCardId === cardId);
    if (roadmapStepToUpdate) {
        roadmapStepToUpdate.completed = cardToUpdate.completed;
        if (!cardToUpdate.completed) roadmapStepToUpdate.isArchived = false;
    }

    updateView();
}

export function handleSubStepToggle(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    const cardId = checkbox.dataset.cardId;
    const subStepId = checkbox.dataset.substepId;

    if (cardId && subStepId) {
        const card = findCardGlobally(cardId);
        if (card && card.subSteps) {
            const subStep = card.subSteps.find(s => s.id === subStepId);
            if (subStep) {
                subStep.completed = checkbox.checked;
            }
        }
        updateView();
    }
}

export function handleChatInputChange(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    const formElement = textarea.closest('.in-card-chat-form');

    if (formElement instanceof HTMLFormElement) {
        const cardId = formElement.dataset.cardId;
        if (cardId) {
            const card = findCardGlobally(cardId);
            if (card) {
                card.currentChatQuery = textarea.value;
            }
        }
    }
}

export function handleDownloadPlan() {
    const state = getState();
    const jsonString = JSON.stringify(state, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-launchpad-plan-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function handleUploadPlan(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonString = e.target?.result as string;
                const loadedState: ApplicationState = JSON.parse(jsonString);

                if (loadedState && loadedState.roadmapSteps && loadedState.detailedCards) {
                    loadAppState(loadedState);
                    setGlobalAiError(null);
                    updateView();
                } else {
                    throw new Error("Invalid plan file format. Missing core properties.");
                }
            } catch (error) {
                console.error("Error loading plan:", error);
                setGlobalAiError(`Failed to load plan: ${error.message}. Ensure it's a valid JSON file.`);
                updateView();
            }
        };
        reader.readAsText(file);
        input.value = '';
    }
}

export function handleDecisionCardHeaderClick(event: Event) {
    const headerElement = (event.currentTarget as HTMLElement);
    const cardId = headerElement.dataset.cardId;
    if (!cardId) return;

    const { detailedCards, archivedCards } = getState();
    const card = findCardGlobally(cardId);
    if (card && card.type === 'decision' && !card.completed && !archivedCards.includes(card)) {
        card.isExpanded = !card.isExpanded;
        const cardElement = document.getElementById(`card-${card.id}`);
        if (cardElement) {
            const contentWrapper = cardElement.querySelector('.card-content-wrapper');
            const toggleIcon = headerElement.querySelector('.card-toggle-icon');
            headerElement.setAttribute('aria-expanded', String(card.isExpanded));
            if (contentWrapper) {
                contentWrapper.classList.toggle('collapsed', !card.isExpanded);
            }
            if (toggleIcon) {
                toggleIcon.innerHTML = card.isExpanded ? '▼' : '▶';
            }
            if (card.isExpanded && detailedCards.includes(card)) {
                 updateView();
            }
        }
    }
}

export function attachAllEventListeners() {
    const form = document.getElementById('project-description-form') as HTMLFormElement;
    if (form) {
        form.removeEventListener('submit', handleProjectDescriptionSubmit);
        form.addEventListener('submit', handleProjectDescriptionSubmit);
    }

    document.querySelectorAll('.mini-card').forEach(card => {
        card.removeEventListener('click', miniCardClickHandler);
        card.addEventListener('click', miniCardClickHandler);
        card.removeEventListener('keydown', miniCardKeyHandler);
        card.addEventListener('keydown', miniCardKeyHandler);
    });

    document.querySelectorAll('.detailed-card .complete-btn').forEach(button => {
        button.removeEventListener('click', handleToggleComplete);
        button.addEventListener('click', handleToggleComplete);
    });
    document.querySelectorAll('.detailed-card .break-down-btn, .detailed-card .retry-breakdown-btn').forEach(button => {
        button.removeEventListener('click', breakDownButtonClickHandler);
        button.addEventListener('click', breakDownButtonClickHandler);
    });
    document.querySelectorAll('.detailed-card .in-card-chat-form').forEach(chatFormEl => {
        if (chatFormEl instanceof HTMLFormElement) {
            chatFormEl.removeEventListener('submit', inCardChatFormSubmitHandler);
            chatFormEl.addEventListener('submit', inCardChatFormSubmitHandler);
        }
    });
    document.querySelectorAll('.detailed-card .chat-input').forEach(input => {
        input.removeEventListener('input', handleChatInputChange);
        input.addEventListener('input', handleChatInputChange);
    });
    document.querySelectorAll('.detailed-card .sub-step-list input[type="checkbox"]').forEach(checkbox => {
        checkbox.removeEventListener('change', handleSubStepToggle);
        checkbox.addEventListener('change', handleSubStepToggle);
    });
    document.querySelectorAll('.detailed-card-header.clickable').forEach(header => {
        header.removeEventListener('click', handleDecisionCardHeaderClick);
        header.addEventListener('click', handleDecisionCardHeaderClick);
        header.removeEventListener('keydown', (e: Event) => decisionCardHeaderKeydownHandler(e as KeyboardEvent));
        header.addEventListener('keydown', (e: Event) => decisionCardHeaderKeydownHandler(e as KeyboardEvent));
    });


    const uploadPlanInput = document.getElementById('upload-plan-input');
    if (uploadPlanInput) {
        uploadPlanInput.removeEventListener('change', handleUploadPlan);
        uploadPlanInput.addEventListener('change', handleUploadPlan);
    }
    const uploadPlanLabel = document.querySelector('label[for="upload-plan-input"]');
    if (uploadPlanLabel) {
        const keydownListener = (e: Event) => {
            if (e instanceof KeyboardEvent && (e.key === 'Enter' || e.key === ' ')) {
                 e.preventDefault();
                (document.getElementById('upload-plan-input') as HTMLElement)?.click();
            }
        };
        uploadPlanLabel.removeEventListener('keydown', keydownListener);
        uploadPlanLabel.addEventListener('keydown', keydownListener);
    }
}

function miniCardClickHandler(this: HTMLElement) {
    const cardId = this.getAttribute('data-scroll-to');
    if (cardId) {
        const targetElement = document.getElementById(cardId);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });

            const cardData = findCardGlobally(cardId.replace('card-', ''));
            if (cardData && cardData.type === 'decision' && !cardData.completed && !getState().archivedCards.find(c=>c.id === cardData.id)) {
                if (!cardData.isExpanded) {
                    cardData.isExpanded = true;
                    const header = targetElement.querySelector('.detailed-card-header.clickable');
                    const contentWrapper = targetElement.querySelector('.card-content-wrapper');
                    const toggleIcon = header?.querySelector('.card-toggle-icon');
                    if (header) header.setAttribute('aria-expanded', 'true');
                    if (contentWrapper) contentWrapper.classList.remove('collapsed');
                    if (toggleIcon) toggleIcon.innerHTML = '▼';
                    updateView();
                }
            }
        } else {
             console.warn(`Mini-card target ${cardId} not found.`);
        }
    }
}
function miniCardKeyHandler(this: HTMLElement, event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        miniCardClickHandler.call(this);
    }
}
function decisionCardHeaderKeydownHandler(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleDecisionCardHeaderClick(event);
    }
}
function breakDownButtonClickHandler(this: HTMLButtonElement) {
    const cardId = this.dataset.cardId;
    if (cardId) handleBreakDownStep(cardId);
}
function inCardChatFormSubmitHandler(this: HTMLFormElement, event: Event) {
    event.preventDefault();
    const cardId = this.dataset.cardId;
    const input = this.querySelector('.chat-input') as HTMLTextAreaElement;
    if (cardId && input && input.value.trim()) {
        handleInCardChatSubmit(cardId, input.value.trim());
    }
}
