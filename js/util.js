const rgbStringToArray = (rgbString) => {
    const rgbValues = rgbString.match(/\d+/g);
    const black = [0, 0, 0]
    if (!rgbValues) return black; // Default to black if no match found
    if (!rgbValues.length) return black; // If no numbers found, return black
    if (rgbValues.length != 3) return black;

    return rgbValues.map(value => parseInt(value, 10));
};

const dataToLngLatArr = (data) => {
    return [data.longitude, data.latitude];
}

const getDimensionsOfElement = (selector) => {
    const element = document.querySelector(selector);
    if (!element) {
        console.error(`Element with selector ${selector} not found.`);
        return null;
    }
    const rect = element.getBoundingClientRect();
    return {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left
    };
}

const dateInRange = (value, min, max) => {
    const date = new Date(value);
    return date >= new Date(min) && date <= new Date(max);
};

const getMapStyleGeojson = (style) => {
    return `https://basemaps.cartocdn.com/gl/${style}-gl-style/style.json`;
}

const debounce = (func, delay) => {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
};

const util = {
    rgbStringToArray,
    dataToLngLatArr,
    dateInRange,
    debounce,
    getDimensionsOfElement,
    getMapStyleGeojson
}