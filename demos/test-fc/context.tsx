import React, { createContext, useContext } from 'react';
import ReactDOM from 'react-dom/client';

const ctxA = createContext(null);
const ctxB = createContext(undefined);
function App() {
  // useEffect(() => {
  //   return () => console.log('Unmount parent');
  // });
  // return <Child />;
  return (
    <ctxA.Provider value={'A0'}>
      <ctxB.Provider value={'B0'}>
        <ctxA.Provider value={'A1'}>
          <Child />
        </ctxA.Provider>
      </ctxB.Provider>
      <Child />
    </ctxA.Provider>
  );
}

function Child() {
  const a = useContext(ctxA);
  const b = useContext(ctxB);
  console.log('1231231');
  console.log('1', a);
  console.log('2', b);

  // // useEffect(() => {
  // //   return () => console.log('Unmount child');
  // // });
  //
  // const now = performance.now();
  // while (performance.now() - now < 4) {}
  return (
    <div>
      {/*<div>123123</div>*/}
      {/*123123*/}
      {/*123123{a} {b}*/}
      {a}
      {b}
    </div>
  );
  // return 123;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
