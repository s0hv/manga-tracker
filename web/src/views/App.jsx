import React from 'react';


function App({ user }) {
  return (
    <div className="App">
      <header className="App-header">
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a href="/login">
          {user || 'Login'}
        </a>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

function MainApp({ user }) {

  return (
    <App user={user}/>
  )
}

export default MainApp;
