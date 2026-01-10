import './globals.css'
import { Providers } from './providers';

export const metadata = {
  title: 'ApeXplorer Protocol',
  description: 'Stake, Earn, Explore',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}