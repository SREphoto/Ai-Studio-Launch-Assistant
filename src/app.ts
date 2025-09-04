import { getState, initializeAi, setCurrentView } from "./state";
import { updateView, navLaunchpad, navGuide, headerContent, appContainer, loadingOverlay } from "./ui";
import { handleDownloadPlan, attachAllEventListeners } from "./events";
import { eventBus } from "./eventBus";

function rerender() {
    updateView();
    attachAllEventListeners();
}

export function initializeApp() {
    if (!appContainer || !loadingOverlay || !navLaunchpad || !navGuide || !headerContent) {
        console.error("Critical DOM elements are missing. Application cannot start.");
        document.body.innerHTML = "<p>Error: Application critical elements are missing. Please reload.</p>";
        return;
    }

    eventBus.on('state-changed', rerender);

    navLaunchpad.addEventListener('click', (e) => {
        e.preventDefault();
        if (getState().currentView !== 'launchpad') {
            setCurrentView('launchpad');
            rerender();
        }
    });

    navGuide.addEventListener('click', (e) => {
        e.preventDefault();
        if (getState().currentView !== 'guide') {
            setCurrentView('guide');
            rerender();
        }
    });

    initializeAi();

    if (!document.getElementById('download-plan-btn') && headerContent) {
        const downloadButton = document.createElement('button');
        downloadButton.id = 'download-plan-btn';
        downloadButton.classList.add('action-btn', 'header-action-btn');
        downloadButton.textContent = 'Download Plan';
        downloadButton.setAttribute('aria-label', 'Download current launch plan as JSON file');
        downloadButton.addEventListener('click', handleDownloadPlan);
        headerContent.appendChild(downloadButton);
    }

    rerender();
}
