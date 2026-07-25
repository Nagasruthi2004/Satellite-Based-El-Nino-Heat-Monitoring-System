import React from 'react';

const contacts = [
  { icon: '🚑', label: 'Ambulance', value: '108' },
  { icon: '🚓', label: 'Police', value: '100' },
  { icon: '🔥', label: 'Fire Service', value: '101' },
  { icon: '🏥', label: 'Nearest Hospital', value: 'City General Hospital' },
];

function EmergencyContacts() {
  return (
    <div className="card">
      <h2>🚨 Emergency Contacts</h2>
      <div style={{ marginTop: '12px', display: 'grid', gap: '10px' }}>
        {contacts.map((contact, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #dbeafe',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <strong>{contact.icon} {contact.label}</strong>
              <div>{contact.value}</div>
            </div>
            {contact.label !== 'Nearest Hospital' && (
              <button
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#16a34a',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Call Now
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default EmergencyContacts;
