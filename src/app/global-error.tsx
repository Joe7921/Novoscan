"use client";

import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <html lang="zh">
            <body>
                <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
                    <h2>应用发生全局错误</h2>
                    <p>{error.message}</p>
                    <button onClick={() => reset()}>尝试恢复</button>
                </div>
            </body>
        </html>
    );
}
