type Listener = (...args: any[]) => void;

class EventBus {
    private listeners: { [key: string]: Listener[] } = {};

    on(event: string, listener: Listener) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(listener);
    }

    emit(event: string, ...args: any[]) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(listener => listener(...args));
        }
    }
}

export const eventBus = new EventBus();
