import { useEffect, useRef, useState } from 'react'
import {
  createConnection,
  createLongLivedTokenAuth,
  subscribeEntities,
  type HassEntities,
  type Connection,
} from 'home-assistant-js-websocket'

const HA_URL   = import.meta.env.VITE_HA_URL   as string
const HA_TOKEN = import.meta.env.VITE_HA_TOKEN  as string

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export function useHAWebSocket() {
  const [entities, setEntities]   = useState<HassEntities>({})
  const [status, setStatus]       = useState<ConnectionStatus>('connecting')
  const connRef = useRef<Connection | null>(null)

  useEffect(() => {
    let cancelled = false

    async function connect() {
      try {
        const auth = createLongLivedTokenAuth(HA_URL, HA_TOKEN)
        const conn = await createConnection({ auth })
        if (cancelled) { conn.close(); return }

        connRef.current = conn
        setStatus('connected')

        subscribeEntities(conn, (ents) => {
          if (!cancelled) setEntities({ ...ents })
        })

        conn.addEventListener('disconnected', () => {
          if (!cancelled) setStatus('disconnected')
        })
        conn.addEventListener('reconnect-error', () => {
          if (!cancelled) setStatus('error')
        })
        conn.addEventListener('ready', () => {
          if (!cancelled) setStatus('connected')
        })
      } catch (err) {
        if (!cancelled) setStatus('error')
        console.error('HA WebSocket error:', err)
      }
    }

    connect()
    return () => {
      cancelled = true
      connRef.current?.close()
    }
  }, [])

  const getState   = (id: string) => entities[id]?.state ?? 'unavailable'
  const getNum     = (id: string, fallback = 0) => parseFloat(entities[id]?.state ?? '') || fallback
  const getAttr    = (id: string, attr: string) => entities[id]?.attributes?.[attr]

  return { entities, status, getState, getNum, getAttr }
}
