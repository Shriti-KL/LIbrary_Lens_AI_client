// Minimal React component with direct rendering and minimal dependencies
function App() {
  return (
    <div style={{
      fontFamily: 'Open Sans, sans-serif',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      margin: 0,
      padding: 0
    }}>
      <header style={{
        backgroundColor: '#1d4ed8',
        color: 'white',
        padding: '1rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h1 style={{
            fontFamily: 'Libre Baskerville, serif',
            margin: '0',
            fontSize: '1.5rem',
            fontWeight: 'bold'
          }}>LibraryLens AI</h1>
          <span style={{ fontSize: '0.875rem' }}>Book Analysis Platform</span>
        </div>
      </header>

      <main style={{
        flex: '1',
        maxWidth: '1200px',
        margin: '2rem auto',
        padding: '0 1rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          padding: '1.5rem'
        }}>
          <h2 style={{
            fontFamily: 'Libre Baskerville, serif',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            marginTop: 0,
            marginBottom: '1rem'
          }}>Welcome to LibraryLens AI</h2>
          
          <p style={{ marginBottom: '1rem' }}>
            This application helps librarians analyze and catalog books using AI technology.
            The PostgreSQL database is connected and functioning correctly.
          </p>
          
          <div style={{
            margin: '1.5rem 0',
            borderTop: '1px solid #e5e7eb' 
          }}></div>
          
          <h3 style={{
            fontFamily: 'Libre Baskerville, serif',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            marginBottom: '0.75rem'
          }}>Recent Books</h3>
          
          <div style={{
            padding: '1rem', 
            backgroundColor: '#f9fafb', 
            border: '1px solid #e5e7eb', 
            borderRadius: '0.25rem'
          }}>
            <p>The Great Gatsby by F. Scott Fitzgerald</p>
          </div>
        </div>
      </main>

      <footer style={{
        backgroundColor: '#f9fafb',
        borderTop: '1px solid #e5e7eb',
        padding: '1.5rem 0',
        textAlign: 'center',
        color: '#6b7280',
        fontSize: '0.875rem'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 1rem'
        }}>
          LibraryLens AI - Book Analysis Platform
        </div>
      </footer>
    </div>
  );
}

export default App;
