import { TransformFnParams } from 'class-transformer';

export function NumberArrayTransform(a: TransformFnParams): number[] | undefined {
    if (Array.isArray(a.value)) {
        const result: number[] = [];

        for (const currentValue of a.value) {
            if (currentValue === '') continue;

            const parsedValue = +currentValue;
            if (!isNaN(parsedValue)) result.push(parsedValue);
        }

        return result.length > 0 ? result : undefined;
    } else if (a.value !== '') {
        const parsedValue = +a.value;
        return isNaN(parsedValue) ? undefined : [parsedValue];
    }

    return undefined;
}
