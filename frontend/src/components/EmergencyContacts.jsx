const contacts = [
  { icon: '🚑', label: 'Ambulance',        value: '108', tel: '108' },
  { icon: '🚓', label: 'Police',           value: '100', tel: '100' },
  { icon: '🔥', label: 'Fire Service',     value: '101', tel: '101' },
  { icon: '🏥', label: 'Nearest Hospital', value: 'City General Hospital', tel: null },
];

function EmergencyContacts() {
  return (
    <div className="card">
      <h2>🚨 Emergency Contacts</h2>
      <div className="emergency-grid">
        {contacts.map((contact, index) => (
          <div key={index} className="emergency-item">
            <div className="emergency-info">
              <span className="emergency-icon">{contact.icon}</span>
              <div>
                <div className="emergency-label">{contact.label}</div>
                <div className="emergency-number">{contact.value}</div>
              </div>
            </div>
            {contact.tel && (
              <a href={`tel:${contact.tel}`} className="call-btn">
                📞 Call
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default EmergencyContacts;
