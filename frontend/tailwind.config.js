/** @type {import('tailwindcss').Config} */
// BRUNO corporate palette: #ffffff · #f9f1ea · #ff6a00 · #474747
const brandOrange = {
  50: '#fff5ec', 100: '#ffe8d4', 200: '#ffcea8', 300: '#ffad70', 400: '#ff8a38',
  500: '#ff6a00', 600: '#e65f00', 700: '#bf4f00', 800: '#993f00', 900: '#7a3300', 950: '#421b00',
};
const brandOrangeSoft = {
  50: '#fff8f2', 100: '#ffeee0', 200: '#ffd9bd', 300: '#ffbe8f', 400: '#ffa261',
  500: '#ff8a3d', 600: '#f07220', 700: '#c95a12', 800: '#a3480e', 900: '#7d3709', 950: '#441c03',
};
const brandGray = {
  50: '#f7f5f3', 100: '#eeebe8', 200: '#dcd8d4', 300: '#bfbab5', 400: '#9a9591',
  500: '#7a7674', 600: '#5e5b59', 700: '#474747', 800: '#3a3a3a', 900: '#2e2e2e', 950: '#1f1f1f',
};
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
  			brand: {
  				white: '#ffffff',
  				cream: '#f9f1ea',
  				orange: '#ff6a00',
  				gray: '#474747'
  			},
  			orange: brandOrange,
  			pink: brandOrangeSoft,
  			zinc: brandGray,
  			gray: brandGray,
  			stone: brandGray,
  			neutral: brandGray,
  			purple: brandGray,
  			violet: brandGray,
  			fuchsia: brandGray,
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
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