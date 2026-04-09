type DesktopVersions = {
  node: string;
  chrome: string;
  electron: string;
};

type DesktopMeta = {
  platform: string;
  versions: DesktopVersions;
};

const platformName: Record<string, string> = {
  darwin: "macOS",
  win32: "Windows",
  linux: "Linux"
};

const starterCards = [
  {
    title: "Desktop Shell",
    body: "Electron main/preload 구성이 들어가 있어서 네이티브 윈도우와 브라우저 UI를 바로 연결할 수 있습니다."
  },
  {
    title: "Renderer Stack",
    body: "React + TypeScript + Vite 조합으로 화면 작업과 컴포넌트 확장을 빠르게 시작할 수 있습니다."
  },
  {
    title: "Packaging",
    body: "macOS와 Windows용 배포 스크립트를 package.json에 미리 추가해 두었습니다."
  }
];

const desktopMeta: DesktopMeta = window.desktopAPI
  ? {
      platform: window.desktopAPI.platform,
      versions: window.desktopAPI.versions
    }
  : {
      platform: "unknown",
      versions: {
        node: "-",
        chrome: "-",
        electron: "-"
      }
    };

function App() {
  const currentPlatform = platformName[desktopMeta.platform] ?? desktopMeta.platform;

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Cross-platform desktop starter</p>
        <h1>
          AI Note
          <br />
          Desktop
        </h1>
        <p className="lead">
          맥북과 윈도우에서 같은 코드베이스로 시작할 수 있는 기본 구조를 준비했습니다.
          여기에 에디터, 로컬 저장소, 동기화, AI 기능을 차례로 붙이면 됩니다.
        </p>
        <div className="hero-row">
          <span className="chip">macOS ready</span>
          <span className="chip">Windows ready</span>
          <a
            className="link-chip"
            href="https://www.electronjs.org/docs/latest/"
            target="_blank"
            rel="noreferrer"
          >
            Docs
          </a>
        </div>
      </section>

      <section className="grid">
        <article className="panel panel-highlight">
          <p className="panel-label">Runtime</p>
          <h2>{currentPlatform}</h2>
          <dl className="stats">
            <div>
              <dt>Electron</dt>
              <dd>{desktopMeta.versions.electron}</dd>
            </div>
            <div>
              <dt>Chrome</dt>
              <dd>{desktopMeta.versions.chrome}</dd>
            </div>
            <div>
              <dt>Node.js</dt>
              <dd>{desktopMeta.versions.node}</dd>
            </div>
          </dl>
        </article>

        <article className="panel">
          <p className="panel-label">Starter Scope</p>
          <div className="stack">
            {starterCards.map((card) => (
              <section className="item" key={card.title}>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </section>
            ))}
          </div>
        </article>

        <article className="panel">
          <p className="panel-label">Next Commands</p>
          <div className="command-list">
            <code>npm install</code>
            <code>npm run dev</code>
            <code>npm run dist:mac</code>
            <code>npm run dist:win</code>
          </div>
          <p className="panel-footnote">
            Windows 설치 파일은 CI에서 빌드하는 편이 더 안정적입니다. 로컬 개발은 우선
            <code>npm run dev</code> 기준으로 시작하면 됩니다.
          </p>
        </article>
      </section>
    </main>
  );
}

export default App;
