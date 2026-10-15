import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { backTarget } from '../journeys/engine';
import { screenById, screenBySlug } from '../journeys/screens';
import { primaryStateFor } from '../journeys/galleryStates';
import { useJourney } from '../state/JourneyContext';
import type { Application } from '../state/types';
import { CurrentScreen } from '../screens';
import { S00Resume } from '../screens/EntryScreens';
import { HostNavContext, MerchantFrame } from '../components/MerchantFrame';
import { PrototypeControls } from '../components/PrototypeControls';
import { Annotation } from '../components/Annotation';
import { restartDemo } from '../scenarios/loader';

const COLLAPSE_KEY = 'madfu-demo:controls-collapsed';

/** An application with saved progress worth resuming. */
export function isResumable(app: Application) {
  return app.submission.state === 'draft' && app.screen !== 'S02-L' && (app.screen !== 'S01' || app.duplicate.identityChecked);
}

export function PrototypePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { app, engine, runtime } = useJourney();
  const current = screenById(app.screen);
  const prevScreen = useRef(app.screen);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggle = (v: boolean) => {
    setCollapsed(v);
    try {
      localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const showResume = !slug && isResumable(app);

  // Keep URL and engine state in sync. Browser Back = the screen's Back action
  // when allowed; any other manual URL change snaps back to the current screen.
  useEffect(() => {
    const screenChanged = prevScreen.current !== app.screen;
    prevScreen.current = app.screen;
    if (!slug) {
      if (!isResumable(app)) navigate(`/prototype/${current.slug}`, { replace: true });
      return;
    }
    if (slug === current.slug) return;
    if (screenChanged) {
      navigate(`/prototype/${current.slug}`);
      return;
    }
    const target = screenBySlug(slug);
    if (target && target.id === backTarget(app)) engine.back();
    else navigate(`/prototype/${current.slug}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, app.screen]);

  const shownScreen = showResume ? 'S00' : app.screen;
  const host = {
    sandbox: false,
    exitToOverview: () => navigate('/'),
    restart: () => {
      restartDemo(runtime);
      navigate('/prototype/start');
    },
  };
  const galleryState = primaryStateFor(shownScreen);

  return (
    <HostNavContext.Provider value={host}>
      <div className="flex h-[calc(100vh-48px)]">
        <div className="min-w-0 flex-1 overflow-y-auto bg-neutral-100 px-6 py-5" data-testid="prototype-canvas">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-4">
            <div className="flex items-center justify-between text-[13px] text-neutral-600">
              <div className="flex items-center gap-2">
                <span className="rounded bg-black px-2 py-0.5 font-semibold text-white" data-testid="screen-id">
                  {shownScreen}
                </span>
                <span className="font-medium text-black">{screenById(shownScreen).name}</span>
                <span>· {screenById(shownScreen).audience}</span>
              </div>
              <div className="flex items-center gap-4">
                {galleryState && (
                  <Link className="underline underline-offset-2" to={`/gallery/${galleryState.id}`}>
                    All states of this screen
                  </Link>
                )}
                {collapsed && (
                  <button className="rounded border border-neutral-500 bg-white px-2.5 py-1 text-black" onClick={() => toggle(false)} data-testid="controls-expand">
                    ◂ Prototype Controls
                  </button>
                )}
              </div>
            </div>
            {showResume ? (
              <MerchantFrame screen="S00">
                <S00Resume
                  onContinue={() => {
                    engine.resume();
                    navigate(`/prototype/${screenById(runtime.appStore.get().screen).slug}`);
                  }}
                  onStartNew={() => {
                    restartDemo(runtime);
                    navigate('/prototype/start');
                  }}
                />
              </MerchantFrame>
            ) : (
              <CurrentScreen screen={app.screen as Exclude<typeof app.screen, 'S00'>} />
            )}
            <Annotation screen={shownScreen} globalRef="#/docs/handover" />
          </div>
        </div>
        {!collapsed && <PrototypeControls onCollapse={() => toggle(true)} />}
      </div>
    </HostNavContext.Provider>
  );
}
