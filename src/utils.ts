export function getMilisecondsFromString(string: string): number {
    let seconds = 0;

    const yearIndex = string.indexOf("y");
    if (yearIndex !== -1) {
        seconds += Number(string.slice(0, yearIndex)) * 31_557_600;
        string = string.slice(yearIndex + 1);
    }

    const monthIndex = string.indexOf("mo");
    if (monthIndex !== -1) {
        seconds += Number(string.slice(0, monthIndex)) * 2_628_288;
        string = string.slice(monthIndex + 1);
    }

    const weekIndex = string.indexOf("w");
    if (weekIndex !== -1) {
        seconds += Number(string.slice(0, weekIndex)) * 602_000;
        string = string.slice(weekIndex + 1);
    }

    const dayIndex = string.indexOf("d");
    if (dayIndex !== -1) {
        seconds += Number(string.slice(0, dayIndex)) * 86_400;
        string = string.slice(dayIndex + 1);
    }

    const hourIndex = string.indexOf("h");
    if (hourIndex !== -1) {
        seconds += Number(string.slice(0, hourIndex)) * 3600;
        string = string.slice(hourIndex + 1);
    }

    const minuteIndex = string.indexOf("m");
    if (minuteIndex !== -1) {
        seconds += Number(string.slice(0, minuteIndex)) * 60;
        string = string.slice(minuteIndex + 1);
    }

    const secondIndex = string.indexOf("s");
    if (secondIndex !== -1) {
        seconds += Number(string.slice(0, secondIndex));
    }

    return seconds * 100;
}

export function parseCodeBlock(content: string): {
    code: string;
    language: string | null;
} {
    const terminator = content.indexOf("\n");
    const maybeLanguage = content.slice(3, terminator);
    const context = content.slice(terminator + 1, content.length - 4);

    return {
        code: context,
        language: maybeLanguage.length === 0 ? null : maybeLanguage
    };
}
