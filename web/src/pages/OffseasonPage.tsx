import { CalendarClock, ExternalLink, Heart, Sparkles, Trophy } from 'lucide-react';

export function OffseasonPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <section className="relative min-h-[560px] overflow-hidden bg-[#0057B8] text-white">
        <img src="/images/maw-hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#003f85] via-[#0057B8]/95 to-[#0057B8]/75" />
        <div className="relative mx-auto flex min-h-[560px] max-w-6xl flex-col justify-center px-6 py-20 lg:px-8">
          <img src="/images/maw-logo-rev.png" alt="Make-A-Wish Guam & CNMI" className="mb-10 h-16 w-auto self-start sm:h-20" />
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold">
            <Trophy size={17} /> Golf for Wishes 2026 has concluded
          </div>
          <h1 className="mt-7 max-w-4xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">Thank you for helping create wishes together.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/85">
            The May 2, 2026 Golf for Wishes event is complete and online registration is closed. We are grateful to the golfers, sponsors, volunteers, and supporters who made the day possible.
          </p>
          <a href="https://wish.org/guam" target="_blank" rel="noopener noreferrer" className="mt-9 inline-flex w-fit items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-[#0057B8] transition hover:bg-blue-50">
            Visit Make-A-Wish Guam & CNMI <ExternalLink size={17} />
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 lg:px-8 lg:py-24">
        <div className="grid gap-6 md:grid-cols-3">
          <article className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6">
            <Heart className="text-[#0057B8]" />
            <h2 className="mt-4 text-xl font-bold">Community-powered impact</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">Every registration, sponsorship, and volunteer hour helps bring hope to local wish families.</p>
          </article>
          <article className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6">
            <CalendarClock className="text-[#0057B8]" />
            <h2 className="mt-4 text-xl font-bold">Next event to be announced</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">Registration will reopen when the next charity event and date are confirmed.</p>
          </article>
          <article className="rounded-2xl border border-blue-100 bg-blue-50/50 p-6">
            <Sparkles className="text-[#0057B8]" />
            <h2 className="mt-4 text-xl font-bold">Keep supporting wishes</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600">Visit the chapter website to learn about upcoming activities, volunteering, and ways to give.</p>
          </article>
        </div>
        <div className="mt-12 rounded-3xl bg-[#0057B8] px-6 py-10 text-center text-white sm:px-10">
          <h2 className="text-3xl font-bold">Want to hear about the next event?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-white/80">Follow Make-A-Wish Guam & CNMI through the official chapter website for the latest event announcements.</p>
          <a href="https://wish.org/guam" target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-[#0057B8] hover:bg-blue-50">See chapter updates <ExternalLink size={17} /></a>
        </div>
      </section>

      <footer className="border-t border-neutral-200 px-6 py-7 text-center text-xs text-neutral-500">Event platform built by <a href="https://shimizu-technology.com" className="font-semibold hover:text-neutral-800">Shimizu Technology</a></footer>
    </main>
  );
}
