import { v4 as uuidv4 } from 'uuid';

export interface Position {
    index: number[];
    site: string;
    clock: number;
}

export interface Character {
    id: string;
    value: string;
    position: Position;
    metadata: CharacterMetadata;
}

export interface CharacterMetadata {
    bold: boolean;
    italic: boolean;
    deleted: boolean;
}

export class DocumentCRDT {
    private characters: Map<string, Character>;
    private siteId: string;
    private clock: number;
    private BASE = 32;
    private BOUNDARY = 10;

    constructor(siteId: string) {
        this.characters = new Map();
        this.siteId = siteId;
        this.clock = 0;
    }

    private generatePositionBetween(
        prev: Position | null,
        next: Position | null,
        newPos: number[] = []
    ): Position {
        if (!prev && !next) {
            return {
                index: [this.BASE],
                site: this.siteId,
                clock: this.incrementClock(),
            };
        }

        if (!prev) {
            return {
                index: this.generatePositionBefore(next!.index),
                site: this.siteId,
                clock: this.incrementClock(),
            };
        }

        if (!next) {
            return {
                index: this.generatePositionAfter(prev.index),
                site: this.siteId,
                clock: this.incrementClock(),
            };
        }

        const prevIndex = prev.index;
        const nextIndex = next.index;
        let head = newPos;

        let i = 0;
        while (i < prevIndex.length && i < nextIndex.length) {
            if (prevIndex[i] !== nextIndex[i]) {
                break;
            }
            head.push(prevIndex[i]);
            i++;
        }

        const prevDigit = i < prevIndex.length ? prevIndex[i] : 0;
        const nextDigit = i < nextIndex.length ? nextIndex[i] : this.BASE;
        const difference = nextDigit - prevDigit;

        if (difference > 1) {
            head.push(prevDigit + Math.floor(difference / 2));
            return {
                index: head,
                site: this.siteId,
                clock: this.incrementClock(),
            };
        } else {
            head.push(prevDigit);
            return this.generatePositionBetween(
                { ...prev, index: prevIndex.slice(i + 1) },
                { ...next, index: nextIndex.slice(i + 1) },
                head
            );
        }
    }

    private generatePositionBefore(index: number[]): number[] {
        if (index[0] <= this.BOUNDARY) {
            return [index[0] - 1];
        }
        return [index[0] - this.BOUNDARY];
    }

    private generatePositionAfter(index: number[]): number[] {
        return [...index, this.BASE];
    }

    private incrementClock(): number {
        return ++this.clock;
    }

    insert(
        value: string,
        prevId: string | null = null,
        nextId: string | null = null,
        metadata: Partial<CharacterMetadata> = {}
    ): Character {
        const prev = prevId ? this.characters.get(prevId) : null;
        const next = nextId ? this.characters.get(nextId) : null;

        const position = this.generatePositionBetween(
            prev?.position || null,
            next?.position || null
        );

        const char: Character = {
            id: uuidv4(),
            value,
            position,
            metadata: {
                bold: metadata.bold || false,
                italic: metadata.italic || false,
                deleted: metadata.deleted || false,
            },
        };

        this.characters.set(char.id, char);
        return char;
    }

    delete(charId: string): void {
        const char = this.characters.get(charId);
        if (char) {
            char.metadata.deleted = true;
        }
    }

    updateMetadata(charId: string, metadata: Partial<CharacterMetadata>): void {
        const char = this.characters.get(charId);
        if (char) {
            char.metadata = { ...char.metadata, ...metadata };
        }
    }

    merge(other: DocumentCRDT): void {
        for (const [id, char] of other.characters) {
            if (!this.characters.has(id)) {
                this.characters.set(id, char);
            } else {
                const existing = this.characters.get(id)!;
                if (this.comparePositions(char.position, existing.position) > 0) {
                    this.characters.set(id, char);
                }
            }
        }
    }

    private comparePositions(pos1: Position, pos2: Position): number {
        const len = Math.min(pos1.index.length, pos2.index.length);
        for (let i = 0; i < len; i++) {
            if (pos1.index[i] !== pos2.index[i]) {
                return pos1.index[i] - pos2.index[i];
            }
        }
        if (pos1.index.length !== pos2.index.length) {
            return pos1.index.length - pos2.index.length;
        }

        if (pos1.site !== pos2.site) {
            return pos1.site.localeCompare(pos2.site);
        }

        return pos1.clock - pos2.clock;
    }

    getText(): Character[] {
        return Array.from(this.characters.values())
            .filter(char => !char.metadata.deleted)
            .sort((a, b) => this.comparePositions(a.position, b.position));
    }

    toJSON(): string {
        return JSON.stringify(Array.from(this.characters.entries()));
    }

    static fromJSON(json: string, siteId: string): DocumentCRDT {
        const doc = new DocumentCRDT(siteId);
        doc.characters = new Map(JSON.parse(json));
        return doc;
    }
}
