import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default function handler() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(160deg, #FCFAF1 0%, #EDF1DE 55%, #C2D9A3 100%)',
          padding: '72px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '36px' }}>
          <div style={{ width: '13px', height: '13px', borderRadius: '50%', background: '#6E8A54' }} />
          <span style={{ fontSize: '26px', color: '#4C6140', letterSpacing: '1px', fontFamily: 'Georgia, serif', fontWeight: '300' }}>
            macro mate
          </span>
        </div>
        <h1
          style={{
            fontSize: '76px',
            fontWeight: '300',
            color: '#232519',
            margin: '0',
            textAlign: 'center',
            lineHeight: 1.06,
            maxWidth: '920px',
            fontFamily: 'Georgia, serif',
          }}
        >
          Eat well without{' '}
          <span style={{ fontStyle: 'italic', color: '#4C6140' }}>thinking</span>
          {' '}about it.
        </h1>
        <p
          style={{
            fontSize: '26px',
            color: '#6C7160',
            marginTop: '32px',
            textAlign: 'center',
            fontFamily: 'system-ui, sans-serif',
            fontWeight: '400',
          }}
        >
          Macro-aware meal planning — plan the week, hit your targets.
        </p>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
