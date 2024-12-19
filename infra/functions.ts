export function toTitleCase<T extends string>(str: any) {
    return str.toLowerCase().split(' ').map((word: any) => {
        return (word.charAt(0).toUpperCase() + word.slice(1));
    }).join(' ') as T;
}
