/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
			forest: '#1F7A63', /* Mapped old primary to new primary */
			champagne: '#F7F9F8', /* Mapped old bg to new bg */
			charcoal: '#1A1A1A', /* Mapped old text to new text */
			warmgray: '#6B7280', /* Mapped old muted to new muted */
			divider: '#E5E7EB', /* Softer borders */
			surface: '#FFFFFF',
			surfaceSoft: '#F9FAFB',
			surfaceActive: '#F3F4F6',
			background: '#F7F9F8',
  			foreground: '#1A1A1A',
  			card: {
  				DEFAULT: '#FFFFFF',
  				foreground: '#1A1A1A'
  			},
  			popover: {
  				DEFAULT: '#FFFFFF',
  				foreground: '#1A1A1A'
  			},
  			primary: {
  				DEFAULT: '#1F7A63',
  				foreground: '#FFFFFF'
  			},
  			secondary: {
  				DEFAULT: '#F3F4F6',
  				foreground: '#111827'
  			},
  			muted: {
  				DEFAULT: '#F3F4F6',
  				foreground: '#6B7280'
  			},
  			accent: {
  				DEFAULT: '#F3F4F6',
  				foreground: '#111827'
  			},
  			destructive: {
  				DEFAULT: '#EF4444',
  				foreground: '#FFFFFF'
  			},
  			border: '#E5E7EB',
  			input: '#E5E7EB',
  			ring: '#1F7A63',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
			serif: ['Inter', 'sans-serif'], /* Force sans everywhere */
			sans: ['Inter', 'sans-serif']
		},
		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};