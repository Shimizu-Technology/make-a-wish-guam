import type { ReactNode } from 'react';

interface PublicHeroProps {
  imageUrl?: string | null;
  imageAlt: string;
  children: ReactNode;
  maxWidthClassName?: string;
  containerClassName?: string;
  contentClassName?: string;
  imageDisplay?: 'background' | 'showcase';
}

export function PublicHero({
  imageUrl,
  imageAlt,
  children,
  maxWidthClassName = 'max-w-5xl',
  containerClassName = '',
  contentClassName = '',
  imageDisplay = 'background',
}: PublicHeroProps) {
  const hasShowcaseImage = Boolean(imageUrl) && imageDisplay === 'showcase';
  const hasBackgroundImage = Boolean(imageUrl) && imageDisplay === 'background';
  const resolvedImageUrl = imageUrl ?? undefined;

  return (
    <section className={`relative overflow-hidden text-white ${containerClassName}`.trim()}>
      <div className="absolute inset-0 bg-gradient-to-br from-[#0057B8] via-[#00408a] to-[#002d63]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_28%)]" />

      {hasBackgroundImage ? (
        <>
          <div
            className="absolute inset-0 hidden md:block bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url("${imageUrl}")` }}
          />
          <div className="absolute inset-0 hidden md:block bg-[linear-gradient(90deg,rgba(0,37,77,0.94)_0%,rgba(0,64,138,0.78)_48%,rgba(0,87,184,0.72)_100%)]" />
          <div className="absolute inset-0 hidden md:block bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_34%)]" />
        </>
      ) : null}

      <div className={`relative z-10 mx-auto w-full ${maxWidthClassName} px-4 sm:px-6 lg:px-8 py-10 sm:py-12 lg:py-16`}>
        {hasBackgroundImage ? (
          <div className="mb-6 md:hidden">
            <div className="overflow-hidden rounded-[28px] border border-white/15 bg-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.28)] backdrop-blur-sm">
              <div className="aspect-[16/10] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.2),transparent_55%),linear-gradient(135deg,rgba(255,255,255,0.16),rgba(255,255,255,0.04))] p-3">
                <img
                  src={resolvedImageUrl}
                  alt={imageAlt}
                  className="h-full w-full rounded-[20px] object-contain"
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className={hasShowcaseImage ? 'grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:items-center' : ''}>
          <div className={contentClassName}>{children}</div>

          {hasShowcaseImage ? (
            <div className="relative">
              <div className="overflow-hidden rounded-[30px] border border-white/15 bg-white/10 shadow-[0_28px_80px_rgba(0,0,0,0.28)] backdrop-blur-sm">
                <div className="aspect-[16/10] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_55%),linear-gradient(135deg,rgba(255,255,255,0.18),rgba(255,255,255,0.04))] p-3 sm:p-4">
                  <img
                    src={resolvedImageUrl}
                    alt={imageAlt}
                    className="h-full w-full rounded-[22px] bg-white/95 object-contain"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
