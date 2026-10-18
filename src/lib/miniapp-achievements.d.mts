// Generated from checked TypeScript; edit the corresponding .mts source. MIT.
export interface AchievementValues {
    title: string;
    description: string;
    date: string;
    url: string;
    icon: string;
    status: string;
}
export type Achievement = AchievementValues & {
    id: string;
};
export interface AchievementCollection {
    version: 1;
    revision: number;
    items: Achievement[];
}
export declare const achievementIcons: string[];
export declare const blankAchievement: () => AchievementValues;
export declare function validAchievementDate(value: unknown): value is string;
export declare function achievementDateLabel(value: string): string;
export declare const achievementValues: (item: AchievementValues) => AchievementValues;
export declare const sameAchievement: (a: AchievementValues | null | undefined, b: AchievementValues | null | undefined) => boolean;
export declare class AchievementFieldError extends Error {
    field: string;
    constructor(field: string, message: string);
}
export declare function achievementFields(value: unknown): AchievementValues;
export declare function achievementCommand(value: unknown): Record<string, unknown>;
export declare function achievementCollection(value: unknown): AchievementCollection;
