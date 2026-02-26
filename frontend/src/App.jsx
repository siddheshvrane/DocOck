import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';

function App() {
    const [isDarkMode, setIsDarkMode] = useState(
        localStorage.getItem('theme') === 'dark' ||
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
    );

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    const toggleTheme = () => setIsDarkMode(!isDarkMode);

    return (
        <div className="min-h-screen bg-claude-bg dark:bg-claude-darkBg text-claude-text dark:text-claude-darkText transition-colors duration-300">
            <Dashboard isDarkMode={isDarkMode} toggleTheme={toggleTheme} />
        </div>
    );
}

export default App;
