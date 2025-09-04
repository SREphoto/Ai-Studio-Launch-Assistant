import { marked } from "marked";
import { DetailedCardData, findCardGlobally, getState, RoadmapStep } from "./state";
import { sanitizeHtml } from "./utils";
import { attachAllEventListeners } from "./events";

// --- DOM Elements ---
export const appContainer = document.getElementById('app-container') as HTMLElement;
export const loadingOverlay = document.getElementById('loading-overlay') as HTMLElement;
export const navLaunchpad = document.getElementById('nav-launchpad') as HTMLAnchorElement;
export const navGuide = document.getElementById('nav-guide') as HTMLAnchorElement;
export const headerContent = document.querySelector('.header-content');


export function renderLaunchpad() {
    const {
        currentProjectDescription,
        globalAiError,
        roadmapSteps,
        detailedCards,
        completedDetailedCards,
        archivedCards,
        ai
    } = getState();

    appContainer.innerHTML = `
        <div class="launchpad-layout">
            <div class="launchpad-main-content">
                <section class="launchpad-section" id="project-input-section" aria-labelledby="project-input-heading">
                    <h2 id="project-input-heading">1. Describe Your AI Studio Project</h2>
                    <form id="project-description-form">
                        <label for="project-description" class="sr-only">Project Description</label>
                        <textarea id="project-description" name="project-description" placeholder="E.g., 'A chatbot for customer service that uses a specific knowledge base about electronics', 'An image generator for creating fantasy art', 'A simple game where the AI is the opponent'..." required rows="5" aria-required="true">${currentProjectDescription}</textarea>
                        <div class="form-actions">
                            <button type="submit" id="generate-plan-btn">Generate Launch Plan</button>
                            <label for="upload-plan-input" class="button-like-label action-btn" role="button" tabindex="0" aria-controls="upload-plan-input">Upload Plan (.json)</label>
                            <input type="file" id="upload-plan-input" accept=".json" class="sr-only">
                        </div>
                    </form>
                    <div id="global-ai-error-message" class="error-message" style="display: ${globalAiError ? 'block' : 'none'};" role="alert" aria-live="assertive">${globalAiError || ''}</div>
                </section>

                <section class="launchpad-section" id="roadmap-section" aria-labelledby="roadmap-heading" style="display: ${roadmapSteps.length > 0 ? 'block' : 'none'};">
                    <h2 id="roadmap-heading">2. Your AI-Generated Launch Roadmap</h2>
                    <div id="roadmap-overview" role="navigation" aria-label="Roadmap steps">
                        ${renderRoadmapOverview()}
                    </div>
                </section>

                <section class="launchpad-section" id="detailed-steps-section" aria-labelledby="detailed-steps-heading" style="display: ${detailedCards.length > 0 || completedDetailedCards.length > 0 || archivedCards.length > 0 ? 'block' : 'none'};">
                    <h2 id="detailed-steps-heading">3. Detailed Steps & Guidance</h2>
                    <div id="detailed-cards-container">
                        ${detailedCards.length > 0 ? detailedCards.map(card => renderDetailedCard(card, 'active')).join('') : '<p class="empty-state-message">No active steps. Generate a plan or check completed/archived steps.</p>'}
                    </div>
                </section>

                <section class="launchpad-section" id="completed-roadmap-section" aria-labelledby="completed-roadmap-heading" style="display: ${completedDetailedCards.length > 0 ? 'block' : 'none'};">
                    <h2 id="completed-roadmap-heading">Completed Steps</h2>
                    <div id="completed-cards-container">
                        ${completedDetailedCards.map(card => renderDetailedCard(card, 'completed')).join('')}
                    </div>
                </section>

                <section class="launchpad-section" id="archived-items-section" aria-labelledby="archived-items-heading" style="display: ${archivedCards.length > 0 ? 'block' : 'none'};">
                    <h2 id="archived-items-heading">Archived Items</h2>
                    <div id="archived-cards-container">
                        ${archivedCards.map(card => renderDetailedCard(card, 'archived')).join('')}
                    </div>
                </section>
            </div>
            <aside class="launchpad-sidebar">
                <section id="decisions-made-section" class="launchpad-section sidebar-section" aria-labelledby="decisions-made-heading">
                    <h3 id="decisions-made-heading">Decisions Made</h3>
                    <div id="decisions-made-content">
                        ${renderDecisionsMadeSidebar()}
                    </div>
                </section>
                <section id="color-legend-section" class="launchpad-section sidebar-section" aria-labelledby="color-legend-heading">
                    <h3 id="color-legend-heading">Legend</h3>
                    <div id="color-legend-content">
                        ${renderColorLegend()}
                    </div>
                </section>
            </aside>
        </div>
    `;
    attachAllEventListeners();

    if (globalAiError && !ai) {
        const generateBtn = document.getElementById('generate-plan-btn') as HTMLButtonElement;
        if(generateBtn) generateBtn.disabled = true;
        const errorDiv = document.getElementById('global-ai-error-message') as HTMLDivElement;
        if(errorDiv && !errorDiv.textContent) {
             errorDiv.textContent = "AI features are disabled. API_KEY is not configured.";
             errorDiv.style.display = "block";
        }
    }
    const projectDescTextarea = document.getElementById('project-description') as HTMLTextAreaElement;
    if (projectDescTextarea && currentProjectDescription) {
        projectDescTextarea.value = currentProjectDescription;
    }
}

export function renderRoadmapOverview(): string {
    const { roadmapSteps, detailedCards, completedDetailedCards, archivedCards, selectedOptionForDecision } = getState();
    let html = '';
    const processedOptionStepIds = new Set<string>();

    const allCardsMap = new Map<string, DetailedCardData>();
    [...detailedCards, ...completedDetailedCards, ...archivedCards].forEach(c => allCardsMap.set(c.id, c));

    roadmapSteps.forEach(step => {
        if (processedOptionStepIds.has(step.id) || step.isArchived) return;

        const currentCard = allCardsMap.get(step.relatedCardId);
        if (!currentCard) return;

        if (currentCard.activatedByOptionId) {
            const activatingOptionCard = allCardsMap.get(currentCard.activatedByOptionId);
            if (!activatingOptionCard || selectedOptionForDecision[activatingOptionCard.decisionContextId ?? ''] !== currentCard.activatedByOptionId) {
                const roadmapActivatingOption = roadmapSteps.find(rs => rs.relatedCardId === currentCard.activatedByOptionId);
                if(roadmapActivatingOption?.isArchived) {
                    return;
                }
                if(selectedOptionForDecision[activatingOptionCard.decisionContextId ?? ''] !== currentCard.activatedByOptionId) {
                   return;
                }
            }
        }

        if (step.type === 'decision') {
            html += `<div class="roadmap-group">`;
            html += `<div class="roadmap-decision-row">${renderMiniCard(step)}</div>`;

            const decisionCardId = step.relatedCardId;
            const optionSteps = roadmapSteps.filter(rs => {
                const detailCard = allCardsMap.get(rs.relatedCardId);
                return detailCard &&
                       (detailCard.type === 'option-best' || detailCard.type === 'option-other') &&
                       detailCard.decisionContextId === decisionCardId &&
                       !rs.isArchived;
            });

            if (optionSteps.length > 0) {
                html += `<div class="roadmap-options-row">`;
                optionSteps.forEach(optStep => {
                    html += renderMiniCard(optStep);
                    processedOptionStepIds.add(optStep.id);
                });
                html += `</div>`;
            }
            html += `</div>`;
        } else if (step.type !== 'option-best' && step.type !== 'option-other') {
             html += `<div class="roadmap-group single-step">${renderMiniCard(step)}</div>`;
        }
    });
    if (html.trim() === '') {
      return '<p class="empty-state-message">No roadmap steps to display. Generate or load a plan.</p>';
    }
    return html;
}


export function renderMiniCard(step: RoadmapStep, isInnerOption: boolean = false): string {
    const { selectedOptionForDecision } = getState();
    let extraClass = '';
    if (step.completed) extraClass = 'completed';
    if (step.isArchived) extraClass = 'archived';
    if (isInnerOption) extraClass += ' inner-option-minicard';

    const detailedCard = findCardGlobally(step.relatedCardId);
    let title = step.title;
    if (detailedCard && detailedCard.type !== 'decision' && detailedCard.decisionContextId) {
        const parentDecision = findCardGlobally(detailedCard.decisionContextId);
        if (parentDecision && parentDecision.completed && selectedOptionForDecision[parentDecision.id] !== step.relatedCardId) {
             extraClass += ' archived';
        }
    }


    return `
        <div class="mini-card type-${step.type} ${extraClass}" data-scroll-to="card-${step.relatedCardId}" role="button" tabindex="0" aria-label="Scroll to ${step.title}">
            ${title}
        </div>
    `;
}


export function renderDetailedCard(card: DetailedCardData, context: 'active' | 'completed' | 'archived'): string {
    const { detailedCards, completedDetailedCards, archivedCards, roadmapSteps } = getState();
    let cardContentHtml = card.content;
    if (!card.content.trim().match(/^<\w+/) && card.content.includes('\n')) {
        try {
            cardContentHtml = marked.parse(card.content) as string;
        } catch (e) {
            console.error("Markdown parsing error for card:", card.id, e);
            cardContentHtml = sanitizeHtml(card.content.replace(/\n/g, '<br>'));
        }
    } else {
         cardContentHtml = sanitizeHtml(card.content);
    }

    const mainTaskCompleted = context === 'archived' ? false : card.completed;
    const cardClasses = `detailed-card type-${card.type} ${mainTaskCompleted ? 'completed-style' : ''} context-${context}`;
    const isDecisionCard = card.type === 'decision';
    const isExpanded = card.isExpanded === undefined ? (isDecisionCard && context === 'active' ? false : true) : card.isExpanded;


    let decisionOptionsHtml = '';
    if (isDecisionCard && context === 'active') {
        const optionCards = [...detailedCards, ...completedDetailedCards, ...archivedCards].filter(
            optCard => (optCard.type === 'option-best' || optCard.type === 'option-other') && optCard.decisionContextId === card.id && !archivedCards.includes(optCard)
        ).sort((a,b) => (a.type === 'option-best' ? -1 : 1));

        if(optionCards.length > 0) {
            decisionOptionsHtml = `
                <div class="decision-options-container">
                    <h4>Options for this decision:</h4>
                    <div class="decision-options-minicards">
                        ${optionCards.map(optCard => {
                            const correspondingRoadmapStep = roadmapSteps.find(rs => rs.relatedCardId === optCard.id);
                            return correspondingRoadmapStep ? renderMiniCard(correspondingRoadmapStep, true) : '';
                        }).join('')}
                    </div>
                </div>
            `;
        }
    }

    const headerTitleHtml = `<h3 id="card-heading-${card.id}">${card.title}</h3>`;
    const decisionToggleIcon = isDecisionCard && context === 'active' ? `<span class="card-toggle-icon" aria-hidden="true">${isExpanded ? '▼' : '▶'}</span>` : '';


    return `
        <article id="card-${card.id}" class="${cardClasses}" aria-labelledby="card-heading-${card.id}">
            <div class="detailed-card-header ${isDecisionCard && context === 'active' ? 'clickable' : ''}"
                 data-card-id="${card.id}"
                 ${isDecisionCard && context === 'active' ? `aria-expanded="${isExpanded}" role="button" tabindex="0"` : ''}>
                ${headerTitleHtml}
                ${decisionToggleIcon}
            </div>
            ${ (isDecisionCard && context === 'active' && !isExpanded) ? '' : `
            <div class="card-content-wrapper ${isDecisionCard && context === 'active' && !isExpanded ? 'collapsed' : ''}">
                <div class="card-content">
                    ${cardContentHtml}
                    ${isDecisionCard && context === 'active' && isExpanded ? decisionOptionsHtml : ''}

                    ${context === 'active' && !isDecisionCard ? `
                    <div class="sub-steps-container" id="sub-steps-for-${card.id}">
                        ${card.isBreakingDown ? '<div class="card-loading small-spinner">Breaking down step...</div>' : ''}
                        ${card.breakdownError ? `<div class="error-message internal-error">${card.breakdownError} <button class="action-btn retry-breakdown-btn" data-card-id="${card.id}">Retry</button></div>` : ''}
                        ${card.subSteps && card.subSteps.length > 0 ? `
                            <h4>Actionable Sub-steps:</h4>
                            <ul class="sub-step-list">
                                ${card.subSteps.map((subStep, index) => `
                                    <li class="sub-step-item ${subStep.completed ? 'completed' : ''}">
                                        <input type="checkbox" id="substep-${card.id}-${index}" data-card-id="${card.id}" data-substep-id="${subStep.id}" ${subStep.completed ? 'checked' : ''} aria-labelledby="substep-label-${card.id}-${index}">
                                        <label for="substep-${card.id}-${index}" id="substep-label-${card.id}-${index}">${sanitizeHtml(subStep.instruction)}</label>
                                    </li>
                                `).join('')}
                            </ul>
                        ` : ''}
                        ${(!card.subSteps || card.subSteps.length === 0) && !card.isBreakingDown && !card.breakdownError && card.type !== 'warning' ? `
                            <button class="action-btn break-down-btn" data-card-id="${card.id}">Break Down Step</button>
                        ` : ''}
                    </div>

                    <div class="in-card-chat-container" id="chat-for-${card.id}">
                        <h4>Talk to AI about this step:</h4>
                        <div class="chat-history">
                            ${(card.chatHistory || []).map(msg => `
                                <div class="chat-message ${msg.sender}">
                                    <strong>${msg.sender === 'user' ? 'You' : 'AI'}:</strong> ${sanitizeHtml(msg.text)}
                                </div>
                            `).join('')}
                        </div>
                        ${card.isChatLoading ? '<div class="card-loading small-spinner">AI is thinking...</div>' : ''}
                        ${card.chatError ? `<div class="error-message internal-error">${card.chatError}</div>` : ''}
                        <form class="in-card-chat-form" data-card-id="${card.id}">
                            <label for="chat-input-${card.id}" class="sr-only">Ask AI a question</label>
                            <textarea id="chat-input-${card.id}" class="chat-input" placeholder="Ask a question about this step..." rows="2" aria-label="Ask AI a question for step ${card.title}">${card.currentChatQuery || ''}</textarea>
                            <button type="submit" class="action-btn ask-ai-btn" ${card.isChatLoading ? 'disabled' : ''}>Ask AI</button>
                        </form>
                    </div>
                    ` : ''}
                </div>
                ${context === 'active' && !isDecisionCard ? `
                <div class="card-footer">
                    <button class="complete-btn ${card.completed ? 'pending-btn' : ''}" data-card-id="${card.id}" aria-pressed="${card.completed}">
                        ${card.completed ? 'Mark as Pending' : 'Mark as Done'}
                    </button>
                </div>
                ` : ''}
                 ${context === 'completed' && !isDecisionCard ? `
                 <div class="card-footer">
                    <button class="complete-btn pending-btn" data-card-id="${card.id}" aria-pressed="true">
                        Mark as Pending
                    </button>
                </div>
                ` : ''}
                ${context === 'active' && isDecisionCard ? `
                 <div class="card-footer">
                    <em class="decision-footer-note">Select an option above and mark it as "Done" to complete this decision.</em>
                </div>
                ` : ''}
            </div>
            `}
        </article>
    `;
}


export function renderDecisionsMadeSidebar(): string {
    const { roadmapSteps, completedDetailedCards, selectedOptionForDecision } = getState();
    let html = '<ul class="decisions-made-list">';
    let hasDecisions = false;

    const decisionOrder = roadmapSteps
        .filter(rs => rs.type === 'decision')
        .map(rs => rs.relatedCardId);

    const completedDecisionCards = completedDetailedCards.filter(card => card.type === 'decision');

    completedDecisionCards.sort((a,b) => {
        const indexA = decisionOrder.indexOf(a.id);
        const indexB = decisionOrder.indexOf(b.id);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });


    completedDecisionCards.forEach(card => {
        if (selectedOptionForDecision[card.id]) {
            const chosenOptionId = selectedOptionForDecision[card.id];
            const chosenOptionCard = findCardGlobally(chosenOptionId!);
            if (chosenOptionCard) {
                html += `
                    <li class="decision-made-item">
                        <strong class="decision-title">${sanitizeHtml(card.title)}</strong>
                        <span class="chosen-option">${sanitizeHtml(chosenOptionCard.title)}</span>
                    </li>
                `;
                hasDecisions = true;
            }
        }
    });
    html += '</ul>';
    if (!hasDecisions) {
        return '<p class="empty-state-message">No decisions made yet.</p>';
    }
    return html;
}

export function renderColorLegend(): string {
    const legendItems = [
        { type: 'step', label: 'Step: A general task or action item.', class: 'type-step' },
        { type: 'decision', label: 'Decision: A point where a choice needs to be made.', class: 'type-decision' },
        { type: 'option-best', label: 'Option (Best Practice): A recommended choice.', class: 'type-option-best' },
        { type: 'option-other', label: 'Option (Alternative): An alternative choice.', class: 'type-option-other' },
        { type: 'warning', label: 'Warning: An important alert or consideration.', class: 'type-warning' },
        { type: 'status', label: 'Completed: Task or decision is finished.', class: 'completed item-example' },
        { type: 'status', label: 'Archived: Option or step is no longer relevant.', class: 'archived item-example' }
    ];

    return `
        <ul class="color-legend-list">
            ${legendItems.map(item => `
                <li class="legend-item">
                    <span class="legend-swatch ${item.class}" ${item.type === 'status' ? 'aria-label="Example ' + item.label + '"' : ''}>
                        ${item.class.includes('item-example') ? (item.class.includes('completed') ? '✓' : '✗') : ''}
                    </span>
                    <span class="legend-label">${item.label}</span>
                </li>
            `).join('')}
        </ul>
    `;
}


import { staticGuideData } from "./staticData";

export function renderGuide() {
    appContainer.innerHTML = `
        <h2 class="guide-main-heading">Deployment Guide</h2>
        <div id="guide-cards-container">
            ${staticGuideData.map((card, index) => `
                <details class="guide-card" ${index === 0 ? 'open' : ''}>
                    <summary>${card.title}</summary>
                    <div class="card-content">
                        ${card.content}
                    </div>
                </details>
            `).join('')}
        </div>
    `;
     attachAllEventListeners();
}

export function updateLoadingState(isLoading: boolean) {
    if (loadingOverlay) {
        loadingOverlay.style.display = isLoading ? 'flex' : 'none';
        loadingOverlay.setAttribute('aria-hidden', String(!isLoading));
    }
    const generateBtn = document.getElementById('generate-plan-btn') as HTMLButtonElement;
    if(generateBtn) {
        generateBtn.disabled = isLoading || !getState().ai;
    }
}

export function updateView() {
    const { currentView, detailedCards, isLoadingAiResponse } = getState();
    navLaunchpad.classList.toggle('active', currentView === 'launchpad');
    navGuide.classList.toggle('active', currentView === 'guide');

    const scrollPositions: { [key: string]: number } = {};
    if (currentView === 'launchpad') {
        const mainContent = document.querySelector('.launchpad-main-content');
        if (mainContent) scrollPositions.main = mainContent.scrollTop;

        detailedCards.forEach(card => {
             if (card.type === 'decision') {
                const element = document.getElementById(`card-${card.id}`);
                if(element) {
                    const header = element.querySelector('.detailed-card-header');
                    if(header) card.isExpanded = header.getAttribute('aria-expanded') === 'true';
                }
             }
        });
    }


    if (currentView === 'launchpad') {
        renderLaunchpad();
    } else {
        renderGuide();
    }
    updateLoadingState(isLoadingAiResponse);

    if (currentView === 'launchpad') {
        const mainContent = document.querySelector('.launchpad-main-content');
        if (mainContent && scrollPositions.main !== undefined) mainContent.scrollTop = scrollPositions.main;
    }
     attachAllEventListeners();
}
