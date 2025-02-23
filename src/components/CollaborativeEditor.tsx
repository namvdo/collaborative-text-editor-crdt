import React, { useState, useCallback, useEffect } from 'react';
import { Bold, Italic, Type, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';

interface Character {
    id: number;
    value: string;
    bold: boolean;
    italic: boolean;
    author: string;
}

interface EditorProps {
    username?: string;
    roomId?: string;
}

const CollaborativeEditor: React.FC<EditorProps> = ({
                                                        username = `User-${Math.floor(Math.random() * 1000)}`,
                                                        roomId = 'default-room'
                                                    }) => {
    const [text, setText] = useState<Character[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [cursorPosition, setCursorPosition] = useState<number>(-1);
    const [activeUsers, setActiveUsers] = useState<number>(1);
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Initialize WebSocket connection
    useEffect(() => {
        const websocket = new WebSocket(`ws://localhost:8080/${roomId}`);

        websocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'user-joined') {
                    setActiveUsers(parseInt(data.content));
                } else if (data.type === 'doc-update') {
                    const newText = JSON.parse(data.content);
                    setText(newText);
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        };

        setWs(websocket);
        return () => websocket.close();
    }, [roomId]);

    const broadcastChanges = useCallback((newText: Character[]) => {
        if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'doc-update',
                content: JSON.stringify(newText),
                roomId
            }));
        }
    }, [ws, roomId]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Backspace') {
            e.preventDefault();
            if (cursorPosition > 0 || selectedId !== null) {
                const newText = selectedId !== null
                    ? text.filter(char => char.id !== selectedId)
                    : text.filter((_, index) => index !== cursorPosition - 1);

                setText(newText);
                setSelectedId(null);
                setCursorPosition(prev => Math.max(0, prev - 1));
                broadcastChanges(newText);
            }
            return;
        }

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setCursorPosition(prev => Math.max(0, prev - 1));
            return;
        }

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            setCursorPosition(prev => Math.min(text.length, prev + 1));
            return;
        }

        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            const newChar: Character = {
                id: Date.now(),
                value: e.key,
                bold: false,
                italic: false,
                author: username
            };

            const insertPosition = cursorPosition === -1 ? text.length : cursorPosition;
            const newText = [
                ...text.slice(0, insertPosition),
                newChar,
                ...text.slice(insertPosition)
            ];

            setText(newText);
            setCursorPosition(insertPosition + 1);
            broadcastChanges(newText);
        }
    }, [text, selectedId, cursorPosition, username, broadcastChanges]);

    const handleFormat = (style: 'bold' | 'italic') => {
        if (selectedId === null) return;
        const newText = text.map(char =>
            char.id === selectedId
                ? { ...char, [style]: !char[style] }
                : char
        );
        setText(newText);
        broadcastChanges(newText);
    };

    const handleClick = (index: number) => {
        setSelectedId(null);
        setCursorPosition(index);
    };

    return (
        <Card className="w-full max-w-4xl mx-auto">
            <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Type className="h-5 w-5" />
                        Collaborative Editor
                    </CardTitle>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">
                            {username}
                        </span>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Users className="h-4 w-4" />
                            {activeUsers} active
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4">
                <div className="mb-4 flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFormat('bold')}
                        className="flex items-center gap-2"
                    >
                        <Bold className="h-4 w-4" />
                        Bold
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFormat('italic')}
                        className="flex items-center gap-2"
                    >
                        <Italic className="h-4 w-4" />
                        Italic
                    </Button>
                </div>
                <div
                    className="min-h-[200px] p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 relative"
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    tabIndex={0}
                    role="textbox"
                    aria-multiline="true"
                >
                    {text.map((char, index) => (
                        <React.Fragment key={char.id}>
                            <span
                                onClick={() => handleClick(index)}
                                className={`
                                    relative
                                    cursor-pointer
                                    ${selectedId === char.id ? 'bg-blue-100 rounded px-0.5' : ''}
                                    ${char.bold ? 'font-bold' : ''}
                                    ${char.italic ? 'italic' : ''}
                                    hover:bg-gray-100 transition-colors
                                `}
                                title={`Written by ${char.author}`}
                            >
                                {char.value}
                            </span>
                            {cursorPosition === index && isFocused && (
                                <span className="border-r-2 border-black h-5 inline-block animate-blink" />
                            )}
                        </React.Fragment>
                    ))}
                    {(cursorPosition === text.length || text.length === 0) && isFocused && (
                        <span className="border-r-2 border-black h-5 inline-block animate-blink" />
                    )}
                </div>
                <div className="mt-4 text-sm text-gray-500">
                    Click to position cursor or select characters for formatting
                </div>
            </CardContent>
        </Card>
    );
};

export default CollaborativeEditor;
