import React, { useState } from 'react';

export default function Counter() {
    const [count, setCount] = useState(0);

    return (
        <div className="p-4 border rounded-lg shadow-md">
            <p className="text-xl mb-2">Count: {count}</p>
            <button
                onClick={() => setCount(count + 1)}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
                Increment
            </button>
        </div>
    );
}
