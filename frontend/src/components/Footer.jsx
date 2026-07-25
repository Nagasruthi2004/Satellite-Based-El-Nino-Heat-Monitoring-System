import React from 'react';

function Footer() {
  return (
    <footer
      style={{
        marginTop: '24px',
        padding: '20px 16px',
        background: '#0f172a',
        color: '#f8fafc',
        textAlign: 'center',
        width: '100%',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto', lineHeight: '1.6' }}>
        <div>© 2026 Satellite-Based El Niño Heat Monitoring System</div>
        <div>Developed by Naga Sruthi &amp; Darunya Sri</div>
        <div>MCA Project</div>
      </div>
    </footer>
  );
}

export default Footer;
