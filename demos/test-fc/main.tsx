import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [num, setNum] = useState(0);
  useEffect(() => {
    console.log('App mount');
  }, []);

  useEffect(() => {
    console.log('num change create', num);
    return () => {
      console.log('num change destroy', num);
    };
  }, [num]);

  return (
    <div onClick={() => setNum(num + 1)}>{num === 0 ? <Child /> : 'noop'}</div>
  );
}

function Child() {
  useEffect(() => {
    console.log('child mount');
    return () => {
      console.log('child unmount');
    };
  }, []);
  return <span>Child </span>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
