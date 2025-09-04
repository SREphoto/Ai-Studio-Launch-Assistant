export function generateUniqueId(prefix: string = 'id'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function sanitizeHtml(htmlString: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlString;

    Array.from(tempDiv.getElementsByTagName('script')).forEach(script => script.remove());
    Array.from(tempDiv.querySelectorAll('*')).forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.toLowerCase().startsWith('on')) {
                el.removeAttribute(attr.name);
            }
            if (attr.name.toLowerCase() === 'href' && attr.value.toLowerCase().startsWith('javascript:')) {
                el.removeAttribute(attr.name);
            }
        });
    });
    return tempDiv.innerHTML;
}
