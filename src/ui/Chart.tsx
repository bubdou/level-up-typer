import type { TestRecord } from '../engine';
import { CONFIG, chartHeadline, chartSeries } from '../engine';
import { COPY, fmtDay } from './copy';

interface Props {
  tests: readonly TestRecord[];
  minutes: number;
  onMinutes: (m: number) => void;
  small?: boolean;
}

/** WPM per test (dots), the average of the last 3 (thick line), best (dashed), and accuracy below. */
export function ProgressChart({ tests, minutes, onMinutes, small }: Props) {
  const data = chartSeries(tests, minutes);
  const head = chartHeadline(data);
  const toggle = (
    <span className="toggle">
      {CONFIG.testDurations.map((m) => (
        <button key={m} aria-pressed={minutes === m} onClick={(e) => { e.currentTarget.blur(); onMinutes(m); }}>
          {m === 1 ? COPY.chart.min1 : COPY.chart.min3}
        </button>
      ))}
    </span>
  );

  if (data.length < 2) {
    return (
      <div className="card chart" data-testid="chart">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="label">{COPY.progress.tests}</span>
          {toggle}
        </div>
        <p className="note">{data.length === 1 ? COPY.chart.oneMore(minutes) : COPY.chart.none(minutes)}</p>
      </div>
    );
  }

  const title = head?.kind === 'up' ? COPY.chart.up(head.wpm) : COPY.chart.best(head?.kind === 'best' ? head.best : 0);
  const wp = data.map((d) => d.wpm);
  const best = Math.max(...wp);
  const W = 640, H = small ? 170 : 220, L = 36, R = 16, T = 16, B = 26;
  const yMax = Math.max(10, Math.ceil((best * 1.25) / 5) * 5);
  const X = (i: number) => L + (i * (W - L - R)) / (data.length - 1);
  const Y = (v: number) => T + (1 - v / yMax) * (H - T - B);
  const step = yMax > 60 ? 20 : yMax > 30 ? 10 : 5;
  const ticks: number[] = [];
  for (let v = 0; v <= yMax; v += step) ticks.push(v);
  const labelIdx = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];
  const AH = 70;
  const AY = (v: number) => 10 + (1 - (Math.max(80, Math.min(100, v)) - 80) / 20) * (AH - 22);
  const ref = CONFIG.testAccuracyTarget;

  return (
    <div className="card chart" data-testid="chart">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="headline" data-testid="chart-title">{title}</span>
        {toggle}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
        {ticks.map((v) => (
          <g key={v}>
            <line className="ax" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} />
            <text className="tick" x={L - 8} y={Y(v) + 4} textAnchor="end">{v}</text>
          </g>
        ))}
        <line className="bestline" x1={L} x2={W - R} y1={Y(best)} y2={Y(best)} />
        <text className="bestlbl" x={W - R} y={Y(best) - 6} textAnchor="end">{COPY.chart.best_label(best)}</text>
        <polyline className="raw" points={wp.map((v, i) => `${X(i)},${Y(v)}`).join(' ')} />
        <polyline className="avg" points={data.map((d, i) => `${X(i)},${Y(d.avg)}`).join(' ')} />
        {data.map((d, i) => (
          <circle key={i} className="pt" cx={X(i)} cy={Y(d.wpm)} r={4}>
            <title>{`${fmtDay(d.date)}: ${d.wpm} wpm`}</title>
          </circle>
        ))}
        {labelIdx.map((i) => (
          <text key={i} className="tick" x={X(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>
            {fmtDay(data[i].date)}
          </text>
        ))}
        <text className="tick" x={L} y={T - 4}>wpm</text>
      </svg>
      <p className="note" style={{ margin: 0 }}>{COPY.chart.legend}</p>
      {!small && (
        <>
          <span className="label" style={{ marginTop: 10, display: 'block' }}>{COPY.chart.accuracy}</span>
          <svg viewBox={`0 0 ${W} ${AH}`} role="img" aria-label={COPY.chart.accuracy} data-testid="accuracy-chart">
            <line className="ref" x1={L} x2={W - R} y1={AY(ref)} y2={AY(ref)} />
            <text className="tick" x={L - 8} y={AY(ref) + 4} textAnchor="end">{ref}%</text>
            <text className="tick" x={L - 8} y={AY(100) + 4} textAnchor="end">100</text>
            <text className="tick" x={L - 8} y={AY(80) + 4} textAnchor="end">80</text>
            {data.map((d, i) => (
              <circle key={i} className="accpt" cx={X(i)} cy={AY(d.accuracy)} r={3.5}>
                <title>{`${fmtDay(d.date)}: ${Math.round(d.accuracy)}%`}</title>
              </circle>
            ))}
          </svg>
        </>
      )}
    </div>
  );
}
