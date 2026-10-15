import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GALLERY_STATES, galleryStateById } from '../journeys/galleryStates';
import { SCREENS, screenById } from '../journeys/screens';
import { JourneyProvider, createSandboxRuntime, useJourney, type JourneyRuntime } from '../state/JourneyContext';
import { CurrentScreen } from '../screens';
import { S00Resume } from '../screens/EntryScreens';
import { HostNavContext, MerchantFrame } from '../components/MerchantFrame';
import { Annotation } from '../components/Annotation';

export function GalleryIndexPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-8 py-10">
      <h1 className="text-[28px] font-semibold">Screen gallery</h1>
      <p className="mt-2 max-w-[760px] text-[15px] text-neutral-600">
        Every screen and its key states, rendered by the real prototype engine with synthetic data. Each state opens as an interactive sandbox — clicking through it does not affect
        your prototype session. {GALLERY_STATES.length} states across {SCREENS.length} screens.
      </p>
      <div className="mt-8 grid grid-cols-3 gap-5">
        {SCREENS.map((s) => {
          const states = GALLERY_STATES.filter((g) => g.screen === s.id);
          return (
            <section key={s.id} className="rounded-md border border-neutral-300 p-4" data-testid={`gallery-screen-${s.id}`}>
              <div className="flex items-center gap-2">
                <span className="rounded bg-black px-2 py-0.5 text-[12px] font-semibold text-white">{s.id}</span>
                <span className="text-[14px] font-semibold">{s.name}</span>
              </div>
              <div className="mt-1 text-[12px] text-neutral-500">
                {s.audience} · {s.kind === 'outcome' ? 'Final outcome' : s.kind === 'future' ? 'Future flow' : 'Screen'}
              </div>
              <ul className="mt-3 flex flex-col gap-1 text-[13px]">
                {states.map((g) => (
                  <li key={g.id}>
                    <Link to={`/gallery/${g.id}`} className="underline underline-offset-2 hover:text-neutral-600">
                      {g.title}
                    </Link>
                    {g.primary && <span className="ml-1.5 text-[11px] text-neutral-500">(primary)</span>}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SandboxView() {
  const { app } = useJourney();
  return <CurrentScreen screen={app.screen as Exclude<typeof app.screen, 'S00'>} />;
}

export function GalleryStatePage() {
  const { stateId = '' } = useParams();
  const navigate = useNavigate();
  const state = galleryStateById(stateId);
  const [runtime, setRuntime] = useState<JourneyRuntime>();
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setRuntime(undefined);
    state?.build().then(({ app, sim }) => alive && setRuntime(createSandboxRuntime(app, sim)));
    return () => {
      alive = false;
    };
  }, [state, nonce]);

  const host = useMemo(() => ({ sandbox: true, exitToOverview: () => navigate('/gallery'), restart: () => setNonce((n) => n + 1) }), [navigate]);

  if (!state) {
    return (
      <div className="p-10">
        Unknown state. <Link to="/gallery">Back to gallery</Link>
      </div>
    );
  }
  const siblings = GALLERY_STATES.filter((g) => g.screen === state.screen);
  const def = screenById(state.screen);
  return (
    <div className="flex min-h-[calc(100vh-48px)]">
      <div className="min-w-0 flex-1 bg-neutral-100 px-6 py-5">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-4">
          <div className="flex items-center justify-between text-[13px] text-neutral-600">
            <div className="flex items-center gap-2">
              <Link to="/gallery" className="underline underline-offset-2">
                Gallery
              </Link>
              <span>/</span>
              <span className="rounded bg-black px-2 py-0.5 font-semibold text-white" data-testid="screen-id">
                {state.screen}
              </span>
              <span className="font-medium text-black">{def.name}</span>
              <span>— {state.title}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded border border-dashed border-neutral-500 px-2 py-0.5 text-[12px]">Sandbox — interactions don't affect the prototype</span>
              <button className="underline underline-offset-2" onClick={() => setNonce((n) => n + 1)}>
                Reset state
              </button>
            </div>
          </div>
          {!runtime ? (
            <div className="flex h-[600px] items-center justify-center rounded-lg border border-neutral-300 bg-white text-neutral-500">Building state…</div>
          ) : (
            <JourneyProvider runtime={runtime} key={`${stateId}-${nonce}`}>
              <HostNavContext.Provider value={host}>
                {state.screen === 'S00' ? (
                  <MerchantFrame screen="S00">
                    <S00Resume onContinue={() => navigate('/gallery/S08--empty')} onStartNew={() => navigate('/gallery/S01--empty')} />
                  </MerchantFrame>
                ) : (
                  <SandboxView />
                )}
              </HostNavContext.Provider>
            </JourneyProvider>
          )}
          <Annotation screen={state.screen} globalRef="#/docs/handover" />
        </div>
      </div>
      <aside className="w-[320px] shrink-0 border-l border-neutral-300 bg-neutral-50 p-4">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-neutral-600">States of {state.screen}</div>
        <ul className="mt-2 flex flex-col gap-1 text-[13px]">
          {siblings.map((g) => (
            <li key={g.id}>
              <Link to={`/gallery/${g.id}`} className={`block rounded px-2 py-1 ${g.id === state.id ? 'bg-black text-white' : 'hover:bg-neutral-200'}`}>
                {g.title}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-6 text-[12px] font-semibold uppercase tracking-wider text-neutral-600">Other screens</div>
        <ul className="mt-2 flex flex-col gap-0.5 text-[12.5px]">
          {SCREENS.map((s) => {
            const first = GALLERY_STATES.find((g) => g.screen === s.id && g.primary) ?? GALLERY_STATES.find((g) => g.screen === s.id);
            return first ? (
              <li key={s.id}>
                <Link to={`/gallery/${first.id}`} className="hover:underline">
                  <span className="font-semibold">{s.id}</span> {s.name}
                </Link>
              </li>
            ) : null;
          })}
        </ul>
      </aside>
    </div>
  );
}
