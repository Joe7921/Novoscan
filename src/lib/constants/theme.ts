// -----------------------------------------------------
// ANTIGRAVITY DESIGN SYSTEM TOKENS
// Modify these values to instantly update the entire app's visual DNA.
// -----------------------------------------------------

export const ANTIGRAVITY_COLORS = {
    background: '#FFFFFF', // Pure white minimal canvas
    foreground: '#111111', // Extreme contrast for high readability

    // The Official Google Brand Colors
    brand: {
        blue: '#4285F4',
        red: '#EA4335',
        yellow: '#FBBC05',
        green: '#34A853',
    },

    // Grays for subtle borders, inactive states, and secondary text
    gray: {
        100: '#F1F3F4',
        200: '#E8EAED',
        300: '#DADCE0',
        400: '#BDC1C6',
        500: '#9AA0A6',
        600: '#80868B',
        700: '#5F6368',
        800: '#3C4043',
        900: '#202124',
    }
};

export const ANTIGRAVITY_SHAPES = {
    // Pill shapes for all buttons and interactive toggles
    pill: '9999px',

    // Giant rounded corners for modern card containers
    giantRadius: '2rem', // Equivalent to 32px or tailwind's 4xl, adjust if needed

    // Extreme spring animations
    springPhysics: {
        type: 'spring' as const,
        damping: 15,
        stiffness: 300,
        mass: 0.8,
    }
};

export const ANTIGRAVITY_TYPOGRAPHY = {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    // Extreme scale for tension
    h1: 'clamp(3rem, 5vw + 1rem, 6rem)',
    h2: 'clamp(2rem, 3vw + 1rem, 4rem)',
    bodySmall: '0.875rem',
};
