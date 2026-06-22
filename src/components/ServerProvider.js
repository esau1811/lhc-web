'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const ServerContext = createContext({ serverId: 1, serverName: 'Global', setServer: () => {} });

export function ServerProvider({ children }) {
  const [server, setServerState] = useState({ id: 1, name: 'Global' });

  useEffect(() => {
    const saved = localStorage.getItem('lhc_server');
    if (saved) {
      try { setServerState(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const setServer = (srv) => {
    setServerState(srv);
    localStorage.setItem('lhc_server', JSON.stringify(srv));
  };

  return (
    <ServerContext.Provider value={{ serverId: server.id, serverName: server.name, setServer }}>
      {children}
    </ServerContext.Provider>
  );
}

export const useServer = () => useContext(ServerContext);
