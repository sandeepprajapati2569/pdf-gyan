import Navbar from './Navbar'

export default function Layout({ children }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.6),rgba(246,244,237,0.96))]" />
        <div className="ambient-grid absolute inset-0 opacity-70" />
        <div className="absolute left-[-12rem] top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-teal-300/18 blur-3xl animate-drift" />
        <div
          className="absolute right-[-10rem] top-[8rem] h-[24rem] w-[24rem] rounded-full bg-amber-200/28 blur-3xl animate-drift"
          style={{ animationDelay: '900ms' }}
        />
        <div
          className="absolute bottom-[-10rem] left-[18%] h-[22rem] w-[22rem] rounded-full bg-sky-300/15 blur-3xl animate-drift"
          style={{ animationDelay: '1800ms' }}
        />
      </div>

      <Navbar />
      <main className="app-main relative z-10 flex-1">{children}</main>
    </div>
  )
}
