import React, { useState, useRef, useEffect } from "react";
import {
  CalendarDays, Users, ShoppingCart, Package, ShieldAlert, BarChart3,
  MessageCircle, LogOut, Plus, X, Check, Search, Trash2, Clock, ArrowRight, Menu,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

/* ---------------------------------------------------------------
   Tokens — monocromático, inspirado na identidade real do estúdio
------------------------------------------------------------------*/

const STYLE = `
  .av-root{
    background-color:#050505;
    color:#F5F5F2;
    font-family: ui-sans-serif, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  .av-display{ font-family: Didot, "Bodoni MT", Georgia, "Times New Roman", serif; }
  .av-wordmark{ font-family: Didot, "Bodoni MT", Georgia, "Times New Roman", serif; letter-spacing:0.06em; }
  .av-surface{ background:#121212; }
  .av-surface-2{ background:#191919; }
  .av-hair{ border-color:#2A2A2A; }
  .av-accent{ color:#F5F5F2; }
  .av-faded{ color:#949490; }
  .av-paper{ background:#F2F1EC; color:#141414; }
  .av-nav-item{ transition: background .15s ease, color .15s ease; }
  .av-nav-item:hover{ background:#191919; }
  .av-nav-active{ background:#191919; box-shadow: inset 3px 0 0 #F5F5F2; }
  .av-card{ background:#121212; border:1px solid #2A2A2A; position:relative; z-index:1; }
  .av-dot::before{
    content:"";
    position:absolute; inset:0;
    background-image: radial-gradient(circle, rgba(245,245,242,0.07) 1px, transparent 1px);
    background-size: 11px 11px;
    pointer-events:none;
  }
  .av-btn-primary{ background:#F5F5F2; color:#0A0A0A; }
  .av-btn-primary:hover{ background:#D9D9D4; }
  .av-btn-ghost{ background:transparent; border:1px solid #3A3A38; color:#D8D8D3; }
  .av-btn-ghost:hover{ background:#191919; }
  .av-input{ background:#0C0C0C; border:1px solid #2A2A2A; color:#F5F5F2; }
  .av-input::placeholder{ color:#6E6E6A; }
  .av-scar{ position:relative; }
  .av-scar::after{
    content:"";
    position:absolute; left:0; right:0; bottom:-1px; height:1px;
    background: repeating-linear-gradient(90deg, #2A2A2A 0 6px, transparent 6px 10px);
  }
  .av-warn{ border-left:2px solid #F5F5F2; }
  .av-ink-layer{ position:absolute; inset:0; z-index:0; overflow:hidden; }
  .av-content-layer{ position:relative; z-index:1; }

  /* ---- layout shell / responsive ---- */
  .av-shell{ min-height:100vh; display:flex; }
  .av-aside{ width:240px; flex-shrink:0; transition: transform .25s ease; }
  .av-topbar-mobile{ display:none; }
  .av-overlay{ display:none; }
  .av-mobile-only{ display:none; }
  .av-desktop-only{ display:block; }
  .av-table-wrap{ overflow-x:auto; }

  @media (max-width: 860px){
    .av-shell{ display:block; }
    .av-aside{
      position:fixed; top:0; left:0; bottom:0; z-index:40;
      transform:translateX(-100%);
      box-shadow: 4px 0 24px rgba(0,0,0,.5);
    }
    .av-aside.open{ transform:translateX(0); }
    .av-topbar-mobile{ display:flex; }
    .av-overlay{ display:none; position:fixed; inset:0; background:rgba(0,0,0,.6); z-index:30; }
    .av-overlay.open{ display:block; }
    .av-mobile-only{ display:block; }
    .av-desktop-only{ display:none; }
    .av-page-header{ padding:20px !important; flex-wrap:wrap; gap:12px; }
    .text-2xl{ font-size:19px !important; }
    .text-xl{ font-size:17px !important; }
    .text-6xl{ font-size:38px !important; }
    .av-grid-side{ grid-template-columns: 1fr !important; }
    .av-grid-side > div:first-child{ border-right:none !important; border-bottom:1px solid #2A2A2A; min-height:auto !important; }
    .av-grid-pdv{ grid-template-columns: 1fr !important; }
    .av-grid-pdv > div:last-child{ border-left:none !important; border-top:1px solid #2A2A2A; }
    .av-modules-grid{ grid-template-columns: 1fr 1fr !important; }
    .av-p8{ padding:20px !important; }
  }
`;

/* ---------------------------------------------------------------
   InkDither — Canvas2D reimplementation of the "Ink Garden" dither
   effect (21st.dev), used as a living background texture behind
   the login screen and the sidebar. Monochrome, animated "pulse".
   Cell size self-adjusts for narrow containers so it never turns
   into an unreadable blob on small rails/phones.
------------------------------------------------------------------*/

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function InkDither({
  srcCanvas,
  cellSize = 10,
  contrast = 158,
  brightness = 0,
  density = 20,
  invert = false,
  animSpeed = 45,
  animIntensity = 55,
  ink = "#F5F5F2",
  opacity = 0.14,
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0, cell: cellSize });

  useEffect(() => {
    if (!srcCanvas) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let cols = 0, rows = 0;
    const sampleCanvas = document.createElement("canvas");
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });

    function resize() {
      const parent = canvas.parentElement;
      const w = parent.clientWidth || 1;
      const h = parent.clientHeight || 1;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // shrink the cell for narrow containers so the sample grid keeps
      // enough resolution to read as texture instead of a big blob
      const effCell = Math.max(4, Math.min(cellSize, w / 26, h / 26));
      sizeRef.current = { w, h, cell: effCell };
      cols = Math.max(1, Math.round(w / effCell));
      rows = Math.max(1, Math.round(h / effCell));
      sampleCanvas.width = cols;
      sampleCanvas.height = rows;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    const contrastF = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const period = 7000 - (animSpeed / 100) * 5000;
    const amp = animIntensity / 100;

    function frame(t) {
      const { w, h, cell } = sizeRef.current;
      sampleCtx.clearRect(0, 0, cols, rows);
      sampleCtx.drawImage(srcCanvas, 0, 0, cols, rows);
      const data = sampleCtx.getImageData(0, 0, cols, rows).data;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = ink;

      const pulse = 0.5 + 0.5 * Math.sin((t / period) * Math.PI * 2);
      const pulseAmt = 1 + (pulse - 0.5) * amp;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          let lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
          lum = lum + brightness / 255;
          lum = (lum - 0.5) * contrastF + 0.5;
          lum = Math.min(1, Math.max(0, lum));
          const ink01raw = invert ? lum : 1 - lum;
          if (ink01raw <= 0.02) continue;

          const threshold = (BAYER4[y % 4][x % 4] + 0.5) / 16;
          const on = ink01raw * pulseAmt > threshold * (1 - density / 100);
          if (!on) continue;

          const size = Math.max(0.6, cell * 0.85 * Math.min(1, ink01raw * pulseAmt));
          const cx = x * cell + cell / 2;
          const cy = y * cell + cell / 2;
          ctx.globalAlpha = Math.min(1, ink01raw * 1.1);
          ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
        }
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [srcCanvas, cellSize, contrast, brightness, density, invert, animSpeed, animIntensity, ink]);

  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, opacity }} />;
}

/* Placeholder blackwork/botanical art — stands in until a real photo
   of an Arte Viva tattoo is supplied to feed the effect. */
function buildPlaceholderArt() {
  const c = document.createElement("canvas");
  c.width = 500;
  c.height = 500;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 500, 500);
  ctx.strokeStyle = "#000000";
  ctx.fillStyle = "#000000";
  ctx.lineCap = "round";
  const cx = 250, cy = 250;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(150, 0, 55, 16, 0, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(60, -40, 100, 0);
    ctx.quadraticCurveTo(60, 40, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  for (let r = 30; r < 90; r += 14) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 24;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 130 + Math.random() * 220;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.9;
    if (x < 0 || y < 0 || x > 500 || y > 500) continue;
    const fade = Math.max(0, 1 - (r - 130) / 220);
    if (Math.random() > fade * 0.9) continue;
    ctx.globalAlpha = fade;
    ctx.beginPath();
    ctx.arc(x, y, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return c;
}

function Flourish({ className = "" }) {
  return (
    <svg viewBox="0 0 240 26" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 13 C 26 3 38 23 58 13 C 78 3 90 23 110 13" stroke="currentColor" strokeWidth="1" />
      <circle cx="120" cy="13" r="2.6" fill="currentColor" />
      <path d="M130 13 C 150 23 162 3 182 13 C 202 23 214 3 240 13" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/* ---------------------------------------------------------------
   Mock data
------------------------------------------------------------------*/

const ARTISTS = {
  alex: { nome: "Alex Soares", especialidade: "Blackwork / Realismo" },
  camila: { nome: "Camila Dama", especialidade: "Fineline / Botânico" },
};

const initialClients = [
  {
    id: 1, nome: "Camila Ferraz", telefone: "(11) 98221-4470",
    endereco: "Rua das Acácias, 210 – Atibaia/SP", cpf: "321.900.554-10",
    cadastradoEm: "12/03/2025",
    anamnese: {
      alergias: "Nenhuma alergia conhecida", medicamentos: "Nenhum em uso",
      condicoes: "Nenhuma condição relevante relatada", queloide: "Não",
      gestanteLactante: "Não", assinadoEm: "12/03/2025", validaAte: "12/03/2027",
    },
    blacklist: false,
  },
  {
    id: 2, nome: "Diego Salgado", telefone: "(11) 97110-2298",
    endereco: "Av. Horácio Neto, 880 – Atibaia/SP", cpf: "455.221.870-02",
    cadastradoEm: "02/05/2024",
    anamnese: {
      alergias: "Alergia a esparadrapo comum", medicamentos: "Nenhum em uso",
      condicoes: "Nenhuma condição relevante relatada", queloide: "Não",
      gestanteLactante: "Não", assinadoEm: "02/05/2024", validaAte: "02/05/2026",
    },
    blacklist: true,
    problema: "Faltou a 3 sessões seguidas sem aviso prévio e se recusou a pagar o sinal já combinado.",
    blacklistDesde: "18/11/2024",
  },
  {
    id: 3, nome: "Juliana Prado", telefone: "(11) 99304-5561",
    endereco: "Rua Bela Vista, 55 – Atibaia/SP", cpf: "198.774.330-45",
    cadastradoEm: "27/01/2026",
    anamnese: {
      alergias: "Nenhuma alergia conhecida", medicamentos: "Anticoncepcional oral",
      condicoes: "Nenhuma condição relevante relatada", queloide: "Sim, histórico leve",
      gestanteLactante: "Não", assinadoEm: "27/01/2026", validaAte: "27/01/2028",
    },
    blacklist: false,
  },
  {
    id: 4, nome: "Pedro Anacleto", telefone: "(11) 98812-0034",
    endereco: "Rua Dr. Fábio, 140 – Atibaia/SP", cpf: "552.410.667-88",
    cadastradoEm: "09/08/2026",
    anamnese: {
      alergias: "Nenhuma alergia conhecida", medicamentos: "Nenhum em uso",
      condicoes: "Hipertensão controlada", queloide: "Não",
      gestanteLactante: "Não", assinadoEm: "09/08/2026", validaAte: "09/08/2028",
    },
    blacklist: false,
  },
];

const DIAS = ["Seg 01", "Ter 02", "Qua 03", "Qui 04", "Sex 05", "Sáb 06"];

const initialAppointments = [
  { id: 1, clienteId: 1, artista: "alex", dia: 0, hora: "10:00", duracao: 2, servico: "Fechamento de braço – blackwork", status: "agendado" },
  { id: 2, clienteId: 3, artista: "camila", dia: 0, hora: "14:00", duracao: 1.5, servico: "Botânico fineline – antebraço", status: "agendado" },
  { id: 3, clienteId: 4, artista: "alex", dia: 1, hora: "09:30", duracao: 3, servico: "Realismo – retrato costas", status: "agendado" },
  { id: 4, clienteId: 3, artista: "camila", dia: 2, hora: "11:00", duracao: 1, servico: "Retoque – linha fina", status: "agendado" },
  { id: 5, clienteId: 1, artista: "alex", dia: 3, hora: "15:00", duracao: 2.5, servico: "Blackwork – costela", status: "agendado" },
  { id: 6, clienteId: 4, artista: "camila", dia: 4, hora: "10:00", duracao: 1, servico: "Flash botânico – braço", status: "agendado" },
  { id: 7, clienteId: 3, artista: "alex", dia: 5, hora: "13:00", duracao: 2, servico: "Sessão 2 – fechamento braço", status: "agendado" },
];

const initialProdutos = [
  { id: 1, nome: "Tinta preta Eternal 30ml", quantidade: 12, valorPago: 68, valorVenda: 0, dataCompra: "03/08/2026", fornecedor: "Ink Supply BR" },
  { id: 2, nome: "Agulha RL 09 (cx 50un)", quantidade: 4, valorPago: 95, valorVenda: 0, dataCompra: "20/07/2026", fornecedor: "TattooMED" },
  { id: 3, nome: "Pomada cicatrizante 60g", quantidade: 22, valorPago: 14, valorVenda: 35, dataCompra: "10/08/2026", fornecedor: "Derma Cuidados" },
  { id: 4, nome: "Filme PVC protetor (rolo)", quantidade: 3, valorPago: 42, valorVenda: 0, dataCompra: "15/06/2026", fornecedor: "Ink Supply BR" },
  { id: 5, nome: "Camiseta Arte Viva P/M/G", quantidade: 18, valorPago: 28, valorVenda: 69, dataCompra: "01/08/2026", fornecedor: "Estamparia Bento" },
];

const receita = [
  { mes: "Mar", valor: 8200 }, { mes: "Abr", valor: 9100 }, { mes: "Mai", valor: 7600 },
  { mes: "Jun", valor: 10400 }, { mes: "Jul", valor: 11800 }, { mes: "Ago", valor: 12950 },
];

const templatesMensagem = [
  {
    id: "24h", titulo: "24 horas antes", ativo: true,
    texto: "Oi {{nome}}! Passando para confirmar sua sessão amanhã, {{data}} às {{hora}}, com {{artista}} no Arte Viva. Chegue com 10 minutos de antecedência e evite álcool no dia anterior. Qualquer coisa é só responder por aqui.",
  },
  {
    id: "1h", titulo: "1 hora antes", ativo: true,
    texto: "{{nome}}, sua sessão com {{artista}} começa em 1 hora aqui no Arte Viva. Te esperamos!",
  },
  {
    id: "final", titulo: "Finalização do trabalho", ativo: true,
    texto: "Prontinho, {{nome}}! Sua tattoo foi finalizada hoje. Cuidados: mantenha a proteção por 2h, lave com sabão neutro 2x ao dia, use a pomada indicada e evite sol e piscina por 15 dias. Vamos te chamar em {{diasRetorno}} dias para avaliar a cicatrização.",
  },
];

function formatBRL(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ---------------------------------------------------------------
   Login
------------------------------------------------------------------*/

function Login({ onEntrar, artCanvas }) {
  return (
    <div className="av-root min-h-screen flex items-center justify-center p-6" style={{ position: "relative" }}>
      <div className="av-ink-layer">
        {artCanvas && <InkDither srcCanvas={artCanvas} opacity={0.16} />}
      </div>
      <div className="av-content-layer w-full max-w-3xl">
        <div className="text-center mb-10">
          <div className="av-wordmark text-6xl font-bold uppercase">Arte Viva</div>
          <Flourish className="w-56 h-6 mx-auto av-faded mt-4 mb-3" />
          <div className="av-faded text-sm tracking-wide">estúdio de tatuagem · sistema de gestão</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {Object.entries(ARTISTS).map(([key, a]) => (
            <button
              key={key}
              onClick={() => onEntrar(key)}
              className="av-card av-scar rounded-sm p-7 text-left hover:av-surface-2 transition-colors group relative overflow-hidden"
            >
              <div className="av-dot absolute inset-0 opacity-60" />
              <div className="relative">
                <div className="w-12 h-12 rounded-full border border-white/60 flex items-center justify-center av-display text-lg font-bold mb-4">
                  {a.nome.split(" ")[0][0]}{a.nome.split(" ")[1][0]}
                </div>
                <div className="av-display text-2xl font-bold">{a.nome}</div>
                <div className="av-faded text-sm mt-1">{a.especialidade}</div>
                <div className="av-btn-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium mt-6">
                  Entrar na minha agenda <ArrowRight size={13} />
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="av-faded text-xs text-center mt-8">
          Cada tatuador acessa apenas sua própria agenda e seus próprios atendimentos.
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Shell
------------------------------------------------------------------*/

const NAV = [
  { id: "agenda", label: "Agenda", Icon: CalendarDays },
  { id: "clientes", label: "Clientes", Icon: Users },
  { id: "pdv", label: "PDV", Icon: ShoppingCart },
  { id: "estoque", label: "Estoque", Icon: Package },
  { id: "blacklist", label: "Lista negra", Icon: ShieldAlert },
  { id: "relatorios", label: "Relatórios", Icon: BarChart3 },
  { id: "automacao", label: "Mensagens automáticas", Icon: MessageCircle },
];

function Shell({ artista, tab, setTab, onSair, children, artCanvas }) {
  const [navOpen, setNavOpen] = useState(false);
  function pick(id) {
    setTab(id);
    setNavOpen(false);
  }
  return (
    <div className="av-root av-shell">
      <div className={`av-topbar-mobile av-hair border-b items-center justify-between px-4 py-3`}>
        <button onClick={() => setNavOpen(true)} className="av-faded flex items-center gap-2 text-sm">
          <Menu size={20} /> Menu
        </button>
        <div className="av-wordmark text-sm font-bold uppercase">Arte Viva</div>
        <div style={{ width: 20 }} />
      </div>

      <div className={`av-overlay ${navOpen ? "open" : ""}`} onClick={() => setNavOpen(false)} />

      <aside className={`av-aside av-surface border-r av-hair flex flex-col ${navOpen ? "open" : ""}`} style={{ position: "relative" }}>
        <div className="av-ink-layer">
          {artCanvas && <InkDither srcCanvas={artCanvas} opacity={0.1} cellSize={8} />}
        </div>
        <div className="av-content-layer px-6 py-6 av-scar">
          <div className="av-wordmark av-accent text-xl font-bold uppercase leading-none">Arte Viva</div>
          <Flourish className="w-24 h-3 av-faded mt-2 mb-1" />
          <div className="av-faded text-[11px]">sistema de gestão</div>
        </div>
        <nav className="av-content-layer flex-1 py-3 overflow-y-auto">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => pick(id)}
              className={`av-nav-item w-full flex items-center gap-3 px-6 py-3 text-sm text-left ${tab === id ? "av-nav-active text-[#F5F5F2]" : "av-faded"}`}
            >
              <Icon size={17} strokeWidth={1.7} />
              {label}
            </button>
          ))}
        </nav>
        <div className="av-content-layer px-6 py-5 av-hair border-t">
          <div className="text-sm font-medium">{ARTISTS[artista].nome}</div>
          <div className="av-faded text-xs mb-3">{ARTISTS[artista].especialidade}</div>
          <button onClick={onSair} className="av-faded text-xs flex items-center gap-1.5 hover:text-[#F5F5F2]">
            <LogOut size={13} /> Trocar de usuário
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto" style={{ background: "#050505" }}>{children}</main>
    </div>
  );
}

function PageHeader({ title, sub, right }) {
  return (
    <div className="av-page-header flex items-start justify-between px-8 py-7 av-hair border-b">
      <div>
        <div className="av-display text-2xl font-bold">{title}</div>
        {sub && <div className="av-faded text-sm mt-1">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* ---------------------------------------------------------------
   Agenda
------------------------------------------------------------------*/

function AppointmentCard({ a, cliente, onOpen }) {
  const isAlex = a.artista === "alex";
  return (
    <button
      onClick={() => onOpen(a)}
      className="w-full text-left av-card rounded-sm p-2.5 hover:av-surface-2"
      style={{ borderLeft: `3px ${isAlex ? "solid" : "dashed"} #F5F5F2` }}
    >
      <div className="text-[11px] av-faded flex items-center gap-1"><Clock size={10} /> {a.hora} · {isAlex ? "A" : "C"}</div>
      <div className="text-xs font-medium mt-1 leading-snug">{cliente.nome}</div>
      <div className="av-faded text-[11px] mt-0.5 leading-snug">{a.servico}</div>
    </button>
  );
}

function Agenda({ artista, appointments, setAppointments, clients }) {
  const [filtro, setFiltro] = useState("meus");
  const [selecionado, setSelecionado] = useState(null);
  const [aviso, setAviso] = useState("");
  const [diaMobile, setDiaMobile] = useState(0);

  const visiveis = appointments.filter((a) => a.status !== "concluido" && (filtro === "todos" || a.artista === artista));
  const cliente = (id) => clients.find((c) => c.id === id);

  function finalizar(ap) {
    setAppointments((prev) => prev.map((a) => (a.id === ap.id ? { ...a, status: "concluido" } : a)));
    setAviso(`Mensagem de finalização enviada por WhatsApp para ${cliente(ap.clienteId).nome}: cuidados pós-tattoo e retorno de avaliação em 15 dias.`);
    setSelecionado(null);
    setTimeout(() => setAviso(""), 5000);
  }

  return (
    <div>
      <PageHeader
        title="Agenda"
        sub="Semana de 1 a 6 de setembro"
        right={
          <div className="flex av-hair border rounded-sm overflow-hidden text-xs">
            <button onClick={() => setFiltro("meus")} className={`px-4 py-2 ${filtro === "meus" ? "av-btn-primary" : "av-faded"}`}>Meus agendamentos</button>
            <button onClick={() => setFiltro("todos")} className={`px-4 py-2 ${filtro === "todos" ? "av-btn-primary" : "av-faded"}`}>Todos os artistas</button>
          </div>
        }
      />
      {aviso && (
        <div className="mx-8 mt-6 av-card av-warn px-4 py-3 text-sm flex items-center gap-2">
          <Check size={15} className="shrink-0" /> {aviso}
        </div>
      )}

      {/* desktop: semana inteira lado a lado */}
      <div className="av-desktop-only p-8 grid grid-cols-6 gap-3">
        {DIAS.map((dia, i) => (
          <div key={dia} className="min-h-[420px]">
            <div className="av-faded text-xs mb-2 pb-2 av-hair border-b">{dia}</div>
            <div className="space-y-2">
              {visiveis.filter((a) => a.dia === i).sort((a, b) => a.hora.localeCompare(b.hora)).map((a) => (
                <AppointmentCard key={a.id} a={a} cliente={cliente(a.clienteId)} onOpen={setSelecionado} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* mobile: um dia por vez, com abas roláveis */}
      <div className="av-mobile-only av-p8 p-8">
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4" style={{ WebkitOverflowScrolling: "touch" }}>
          {DIAS.map((dia, i) => (
            <button
              key={dia}
              onClick={() => setDiaMobile(i)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs ${diaMobile === i ? "av-btn-primary" : "av-btn-ghost"}`}
            >
              {dia}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {visiveis.filter((a) => a.dia === diaMobile).sort((a, b) => a.hora.localeCompare(b.hora)).map((a) => (
            <AppointmentCard key={a.id} a={a} cliente={cliente(a.clienteId)} onOpen={setSelecionado} />
          ))}
          {visiveis.filter((a) => a.dia === diaMobile).length === 0 && (
            <div className="av-faded text-sm">Nenhum horário marcado nesse dia.</div>
          )}
        </div>
      </div>

      {selecionado && (
        <Modal onClose={() => setSelecionado(null)}>
          <div className="av-display text-xl font-bold mb-1">{cliente(selecionado.clienteId).nome}</div>
          <div className="av-faded text-sm mb-5">{selecionado.servico}</div>
          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <Info label="Data" value={`${DIAS[selecionado.dia]} · ${selecionado.hora}`} />
            <Info label="Duração prevista" value={`${selecionado.duracao} h`} />
            <Info label="Artista" value={ARTISTS[selecionado.artista].nome} />
            <Info label="Telefone" value={cliente(selecionado.clienteId).telefone} />
          </div>
          <div className="flex gap-3">
            <button onClick={() => finalizar(selecionado)} className="av-btn-primary rounded-full px-4 py-2.5 text-sm font-medium flex items-center gap-2">
              <Check size={15} /> Finalizar atendimento
            </button>
            <button onClick={() => setSelecionado(null)} className="av-btn-ghost rounded-full px-4 py-2.5 text-sm">Fechar</button>
          </div>
          <div className="av-faded text-xs mt-4">
            Ao finalizar, o horário sai da agenda e o cliente recebe a mensagem de cuidados com data de retorno para avaliação.
          </div>
        </Modal>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="av-faded text-[11px] mb-1">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
      <div className="av-card rounded-sm p-7 max-w-md w-full relative">
        <button onClick={onClose} className="absolute top-4 right-4 av-faded hover:text-[#F5F5F2]"><X size={18} /></button>
        {children}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Clientes + anamnese
------------------------------------------------------------------*/

function Clientes({ clients, setClients }) {
  const [selId, setSelId] = useState(clients[0].id);
  const [busca, setBusca] = useState("");
  const [marcando, setMarcando] = useState(false);
  const [problema, setProblema] = useState("");
  const c = clients.find((x) => x.id === selId);

  function marcarBlacklist() {
    setClients((prev) => prev.map((x) => (x.id === c.id ? { ...x, blacklist: true, problema, blacklistDesde: "31/08/2026" } : x)));
    setMarcando(false);
    setProblema("");
  }

  const filtrados = clients.filter((x) => x.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div>
      <PageHeader title="Clientes" sub="Cadastro e ficha de anamnese" />
      <div className="av-grid-side grid grid-cols-[280px_1fr]">
        <div className="av-hair border-r min-h-[600px]">
          <div className="p-4 av-hair border-b">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 av-faded" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente" className="av-input rounded-sm w-full pl-8 pr-3 py-2 text-sm" />
            </div>
          </div>
          {filtrados.map((x) => (
            <button key={x.id} onClick={() => setSelId(x.id)} className={`w-full text-left px-4 py-3 av-hair border-b av-nav-item ${selId === x.id ? "av-surface-2" : ""}`}>
              <div className="text-sm font-medium flex items-center gap-2">
                {x.nome}
                {x.blacklist && <ShieldAlert size={12} className="shrink-0" />}
              </div>
              <div className="av-faded text-xs mt-0.5">{x.telefone}</div>
            </button>
          ))}
        </div>

        <div className="p-8 av-p8">
          <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
            <div>
              <div className="av-display text-xl font-bold">{c.nome}</div>
              <div className="av-faded text-sm">Cliente desde {c.cadastradoEm}</div>
            </div>
            {!c.blacklist && (
              <button onClick={() => setMarcando(true)} className="av-btn-ghost rounded-sm px-3 py-2 text-xs flex items-center gap-1.5">
                <ShieldAlert size={13} /> Marcar na lista negra
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
            <Info label="Telefone" value={c.telefone} />
            <Info label="CPF" value={c.cpf} />
            <Info label="Endereço" value={c.endereco} />
            <Info label="Situação" value={c.blacklist ? "Lista negra" : "Regular"} />
          </div>

          {c.blacklist && (
            <div className="av-card av-warn rounded-sm p-4 mb-8 text-sm">
              <div className="font-medium mb-1">Ocorrência registrada em {c.blacklistDesde}</div>
              <div className="av-faded">{c.problema}</div>
            </div>
          )}

          <div className="av-paper av-scar rounded-sm p-6 relative overflow-hidden">
            <div className="av-dot absolute inset-0 opacity-[0.1]" />
            <div className="relative">
              <div className="av-display text-lg font-bold mb-0.5">Ficha de anamnese</div>
              <div className="text-xs mb-5" style={{ color: "#6B6B66" }}>
                Gerada automaticamente a partir do cadastro · assinada em {c.anamnese.assinadoEm} · guardada até {c.anamnese.validaAte} conforme LGPD
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <PaperField label="Alergias" value={c.anamnese.alergias} />
                <PaperField label="Medicamentos em uso" value={c.anamnese.medicamentos} />
                <PaperField label="Condições de saúde" value={c.anamnese.condicoes} />
                <PaperField label="Histórico de queloide" value={c.anamnese.queloide} />
                <PaperField label="Gestante ou lactante" value={c.anamnese.gestanteLactante} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {marcando && (
        <Modal onClose={() => setMarcando(false)}>
          <div className="av-display text-xl font-bold mb-4">Marcar {c.nome} na lista negra</div>
          <div className="av-faded text-xs mb-2">Descreva o que aconteceu</div>
          <textarea value={problema} onChange={(e) => setProblema(e.target.value)} rows={4} className="av-input rounded-sm w-full p-3 text-sm mb-5" placeholder="Ex.: cliente causou dano à sala, deixou de pagar, etc." />
          <div className="flex gap-3">
            <button onClick={marcarBlacklist} disabled={!problema} className="av-btn-primary rounded-full px-4 py-2.5 text-sm font-medium disabled:opacity-40">Confirmar</button>
            <button onClick={() => setMarcando(false)} className="av-btn-ghost rounded-full px-4 py-2.5 text-sm">Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PaperField({ label, value }) {
  return (
    <div>
      <div className="text-[11px] mb-1" style={{ color: "#7A7A74" }}>{label}</div>
      <div>{value}</div>
    </div>
  );
}

/* ---------------------------------------------------------------
   PDV
------------------------------------------------------------------*/

function PDV({ produtos }) {
  const [carrinho, setCarrinho] = useState([]);
  const [pagamento, setPagamento] = useState("pix");
  const [feito, setFeito] = useState(false);
  const vendaveis = produtos.filter((p) => p.valorVenda > 0);

  function add(p) {
    setCarrinho((prev) => {
      const existe = prev.find((i) => i.id === p.id);
      if (existe) return prev.map((i) => (i.id === p.id ? { ...i, qtd: i.qtd + 1 } : i));
      return [...prev, { ...p, qtd: 1 }];
    });
  }
  function remover(id) {
    setCarrinho((prev) => prev.filter((i) => i.id !== id));
  }
  const total = carrinho.reduce((s, i) => s + i.qtd * i.valorVenda, 0);

  function finalizar() {
    setFeito(true);
    setTimeout(() => { setFeito(false); setCarrinho([]); }, 2200);
  }

  return (
    <div>
      <PageHeader title="PDV" sub="Ponto de venda do estúdio" />
      <div className="av-grid-pdv grid grid-cols-[1fr_340px]">
        <div className="p-8 av-p8 grid grid-cols-2 gap-3">
          {vendaveis.map((p) => (
            <button key={p.id} onClick={() => add(p)} className="av-card rounded-sm p-4 text-left hover:av-surface-2">
              <div className="text-sm font-medium">{p.nome}</div>
              <div className="text-sm mt-2">{formatBRL(p.valorVenda)}</div>
              <div className="av-faded text-[11px] mt-1">{p.quantidade} em estoque</div>
            </button>
          ))}
        </div>
        <div className="av-hair border-l p-6 flex flex-col min-h-[500px]">
          <div className="av-display text-lg font-bold mb-4">Venda atual</div>
          <div className="flex-1 space-y-3">
            {carrinho.length === 0 && <div className="av-faded text-sm">Toque em um produto para adicionar.</div>}
            {carrinho.map((i) => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <div>
                  <div>{i.nome}</div>
                  <div className="av-faded text-xs">{i.qtd} × {formatBRL(i.valorVenda)}</div>
                </div>
                <button onClick={() => remover(i.id)} className="av-faded hover:text-[#F5F5F2]"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <div className="av-hair border-t pt-4 mt-4">
            <div className="flex justify-between av-display text-lg font-bold mb-4">
              <span>Total</span><span>{formatBRL(total)}</span>
            </div>
            <div className="flex gap-2 mb-4">
              {["pix", "cartão", "dinheiro"].map((f) => (
                <button key={f} onClick={() => setPagamento(f)} className={`flex-1 rounded-sm py-2 text-xs capitalize ${pagamento === f ? "av-btn-primary" : "av-btn-ghost"}`}>{f}</button>
              ))}
            </div>
            <button onClick={finalizar} disabled={!carrinho.length} className="av-btn-primary rounded-full w-full py-2.5 text-sm font-medium disabled:opacity-40">
              {feito ? "Venda registrada" : "Finalizar venda"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Estoque
------------------------------------------------------------------*/

function Estoque({ produtos, setProdutos }) {
  const [novo, setNovo] = useState(false);
  const [form, setForm] = useState({ nome: "", quantidade: "", valorPago: "", valorVenda: "", dataCompra: "", fornecedor: "" });

  function salvar() {
    setProdutos((prev) => [...prev, { id: Date.now(), ...form, quantidade: Number(form.quantidade), valorPago: Number(form.valorPago), valorVenda: Number(form.valorVenda || 0) }]);
    setForm({ nome: "", quantidade: "", valorPago: "", valorVenda: "", dataCompra: "", fornecedor: "" });
    setNovo(false);
  }

  return (
    <div>
      <PageHeader
        title="Estoque"
        sub="Materiais, insumos e produtos para venda"
        right={<button onClick={() => setNovo(true)} className="av-btn-primary rounded-full px-4 py-2.5 text-sm font-medium flex items-center gap-2"><Plus size={15} /> Novo produto</button>}
      />
      <div className="p-8 av-p8">
        <div className="av-table-wrap">
          <table className="w-full text-sm" style={{ minWidth: 640 }}>
            <thead>
              <tr className="av-faded text-left text-xs av-hair border-b">
                <th className="pb-3 font-normal">Produto</th>
                <th className="pb-3 font-normal">Qtd.</th>
                <th className="pb-3 font-normal">Valor pago</th>
                <th className="pb-3 font-normal">Valor de venda</th>
                <th className="pb-3 font-normal">Última compra</th>
                <th className="pb-3 font-normal">Fornecedor</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.id} className="av-hair border-b">
                  <td className="py-3">{p.nome}</td>
                  <td className="py-3">{p.quantidade}</td>
                  <td className="py-3">{formatBRL(p.valorPago)}</td>
                  <td className="py-3">{p.valorVenda ? formatBRL(p.valorVenda) : <span className="av-faded">uso interno</span>}</td>
                  <td className="py-3">{p.dataCompra}</td>
                  <td className="py-3">{p.fornecedor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {novo && (
        <Modal onClose={() => setNovo(false)}>
          <div className="av-display text-xl font-bold mb-5">Novo produto</div>
          <div className="space-y-3">
            <LabeledInput label="Nome do produto" value={form.nome} onChange={(v) => setForm({ ...form, nome: v })} />
            <div className="grid grid-cols-2 gap-3">
              <LabeledInput label="Quantidade" value={form.quantidade} onChange={(v) => setForm({ ...form, quantidade: v })} />
              <LabeledInput label="Valor pago" value={form.valorPago} onChange={(v) => setForm({ ...form, valorPago: v })} />
              <LabeledInput label="Valor de venda" value={form.valorVenda} onChange={(v) => setForm({ ...form, valorVenda: v })} />
              <LabeledInput label="Data da última compra" value={form.dataCompra} onChange={(v) => setForm({ ...form, dataCompra: v })} />
            </div>
            <LabeledInput label="Nome do fornecedor" value={form.fornecedor} onChange={(v) => setForm({ ...form, fornecedor: v })} />
          </div>
          <button onClick={salvar} className="av-btn-primary rounded-full px-4 py-2.5 text-sm font-medium mt-5">Salvar produto</button>
        </Modal>
      )}
    </div>
  );
}

function LabeledInput({ label, value, onChange }) {
  return (
    <div>
      <div className="av-faded text-[11px] mb-1">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="av-input rounded-sm w-full px-3 py-2 text-sm" />
    </div>
  );
}

/* ---------------------------------------------------------------
   Lista negra
------------------------------------------------------------------*/

function Blacklist({ clients }) {
  const marcados = clients.filter((c) => c.blacklist);
  return (
    <div>
      <PageHeader title="Lista negra" sub="Clientes com ocorrência registrada" />
      <div className="p-8 av-p8 space-y-4">
        {marcados.length === 0 && <div className="av-faded text-sm">Nenhum cliente na lista negra.</div>}
        {marcados.map((c) => (
          <div key={c.id} className="av-card av-warn rounded-sm p-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="av-display font-bold">{c.nome}</div>
              <div className="av-faded text-xs">desde {c.blacklistDesde}</div>
            </div>
            <div className="av-faded text-xs mt-1 mb-3">{c.telefone} · {c.cpf}</div>
            <div className="text-sm">{c.problema}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Relatórios
------------------------------------------------------------------*/

function Relatorios() {
  return (
    <div>
      <PageHeader title="Relatórios" sub="Visão geral do estúdio · agosto de 2026" />
      <div className="p-8 av-p8">
        <div className="grid grid-cols-3 av-modules-grid gap-4 mb-8">
          <StatCard label="Faturamento do mês" value={formatBRL(12950)} />
          <StatCard label="Tatuagens concluídas" value="27" />
          <StatCard label="Ticket médio" value={formatBRL(480)} />
        </div>
        <div className="av-card rounded-sm p-6">
          <div className="av-display font-bold mb-4">Faturamento nos últimos 6 meses</div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={receita}>
                <CartesianGrid stroke="#2A2A2A" vertical={false} />
                <XAxis dataKey="mes" stroke="#949490" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#949490" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip contentStyle={{ background: "#121212", border: "1px solid #2A2A2A", fontSize: 12 }} formatter={(v) => formatBRL(v)} />
                <Line type="monotone" dataKey="valor" stroke="#F5F5F2" strokeWidth={2} dot={{ r: 3, fill: "#F5F5F2" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="av-card rounded-sm p-5">
      <div className="av-faded text-xs mb-2">{label}</div>
      <div className="av-display text-2xl font-bold">{value}</div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Automação de mensagens
------------------------------------------------------------------*/

function Automacao() {
  const [templates, setTemplates] = useState(templatesMensagem);
  return (
    <div>
      <PageHeader title="Mensagens automáticas" sub="Envios por WhatsApp integrados à agenda" />
      <div className="p-8 av-p8 space-y-4 max-w-2xl">
        {templates.map((t) => (
          <div key={t.id} className="av-card rounded-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="av-display font-bold">{t.titulo}</div>
              <button
                onClick={() => setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, ativo: !x.ativo } : x)))}
                className={`w-10 h-5 rounded-full relative transition-colors ${t.ativo ? "av-btn-primary" : "av-hair border"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${t.ativo ? "left-5 bg-black" : "left-0.5 bg-[#F5F5F2]"}`} />
              </button>
            </div>
            <div className="av-faded text-sm leading-relaxed">{t.texto}</div>
          </div>
        ))}
        <div className="av-faded text-xs">
          Os campos entre chaves são preenchidos automaticamente com os dados do agendamento e do cadastro do cliente.
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   App
------------------------------------------------------------------*/

export default function App() {
  const [artista, setArtista] = useState(null);
  const [tab, setTab] = useState("agenda");
  const [clients, setClients] = useState(initialClients);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [produtos, setProdutos] = useState(initialProdutos);
  const [artCanvas, setArtCanvas] = useState(null);

  useEffect(() => {
    setArtCanvas(buildPlaceholderArt());
  }, []);

  if (!artista) {
    return (
      <>
        <style>{STYLE}</style>
        <Login onEntrar={setArtista} artCanvas={artCanvas} />
      </>
    );
  }

  return (
    <>
      <style>{STYLE}</style>
      <Shell artista={artista} tab={tab} setTab={setTab} onSair={() => setArtista(null)} artCanvas={artCanvas}>
        {tab === "agenda" && <Agenda artista={artista} appointments={appointments} setAppointments={setAppointments} clients={clients} />}
        {tab === "clientes" && <Clientes clients={clients} setClients={setClients} />}
        {tab === "pdv" && <PDV produtos={produtos} />}
        {tab === "estoque" && <Estoque produtos={produtos} setProdutos={setProdutos} />}
        {tab === "blacklist" && <Blacklist clients={clients} />}
        {tab === "relatorios" && <Relatorios />}
        {tab === "automacao" && <Automacao />}
      </Shell>
    </>
  );
}