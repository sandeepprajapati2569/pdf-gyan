import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3,
  FileText,
  Globe,
  Loader2,
  MessageSquareText,
  TrendingUp,
} from 'lucide-react'
import client from '../api/client'

const metricConfig = [
  { key: 'total_documents', label: 'PDF sources', icon: FileText, accent: 'var(--teal)' },
  { key: 'total_websites', label: 'Website sources', icon: Globe, accent: '#6366f1' },
  { key: 'total_conversations', label: 'Conversations', icon: MessageSquareText, accent: '#f59e0b' },
  { key: 'total_messages', label: 'Messages', icon: TrendingUp, accent: '#10b981' },
]

export default function AnalyticsPage() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.get('/api/analytics/overview')
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="page-shell max-w-6xl min-h-[60vh]">
        <div className="premium-card flex min-h-[18rem] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
        </div>
      </div>
    )
  }

  const activity = data?.activity || []
  const topDocuments = data?.top_documents || []
  const recentConversations = data?.recent_conversations || []
  const avgMessages = data?.avg_messages_per_conversation || 0
  const maxActivity = Math.max(...activity.map((item) => item.conversations || 0), 1)

  return (
    <div className="page-shell max-w-6xl py-8 sm:py-10">
      <section className="premium-card p-6 sm:p-8">
        <div className="section-intro">
          <h1 className="font-display text-4xl text-slate-950 sm:text-5xl">Dashboard</h1>
          <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            See which sources are most active, how often conversations happen, and where the
            team keeps coming back.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricConfig.map((item) => (
            <article key={item.key} className="soft-card p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl" style={{ background: `${item.accent}16` }}>
                  <item.icon className="h-4 w-4" style={{ color: item.accent }} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950">{data?.[item.key] || 0}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <article className="premium-card p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Activity</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Conversation flow</h2>
            </div>
            <div className="soft-card px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Average</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{avgMessages} messages per conversation</p>
            </div>
          </div>

          {activity.length === 0 ? (
            <div className="soft-card mt-6 p-6 text-sm leading-7 text-slate-500">
              No activity yet. Once your team starts chatting, this view will show the last week of
              conversation volume.
            </div>
          ) : (
            <>
              <div className="mt-6 flex items-end gap-3" style={{ height: '220px' }}>
                {activity.map((day) => {
                  const pct = maxActivity > 0 ? (day.conversations / maxActivity) : 0
                  const barHeight = Math.max(pct * 100, 6)
                  const d = new Date(`${day.date}T12:00:00`)
                  const dayName = d.toLocaleDateString('en', { weekday: 'short' })
                  const dayNum = d.getDate()
                  const isToday = day.date === new Date().toISOString().slice(0, 10)
                  const hasData = day.conversations > 0

                  return (
                    <div key={day.date} className="flex flex-1 flex-col items-center gap-0" style={{ height: '100%' }}>
                      {/* Count */}
                      <span
                        className="text-xs font-bold mb-1"
                        style={{ color: hasData ? 'var(--teal)' : 'var(--muted-soft)' }}
                      >
                        {day.conversations}
                      </span>

                      {/* Bar container */}
                      <div className="flex-1 w-full flex items-end justify-center">
                        <div
                          className="w-full max-w-[44px] rounded-xl transition-all duration-500"
                          style={{
                            height: `${barHeight}%`,
                            background: hasData
                              ? 'linear-gradient(180deg, rgba(15,118,110,0.95), rgba(15,93,117,0.8))'
                              : 'var(--border)',
                            boxShadow: hasData ? '0 4px 12px rgba(15,118,110,0.2)' : 'none',
                          }}
                        />
                      </div>

                      {/* Day label */}
                      <div className="mt-2 flex flex-col items-center">
                        <span
                          className="text-[11px] font-semibold"
                          style={{ color: isToday ? 'var(--teal)' : 'var(--muted)' }}
                        >
                          {dayName}
                        </span>
                        <span
                          className="text-[10px]"
                          style={{ color: isToday ? 'var(--teal-strong)' : 'var(--muted-soft)' }}
                        >
                          {dayNum}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: 'Peak day',
                    value: (() => {
                      const peak = activity.reduce((best, item) => item.conversations > best.conversations ? item : best, activity[0])
                      if (!peak || !peak.conversations) return 'N/A'
                      const d = new Date(`${peak.date}T12:00:00`)
                      return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
                    })(),
                  },
                  { label: 'Conversations', value: data?.total_conversations || 0 },
                  { label: 'Messages', value: data?.total_messages || 0 },
                ].map((stat) => (
                  <div key={stat.label} className="soft-card flex items-center gap-3 p-4">
                    <div>
                      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{stat.label}</p>
                      <p className="mt-1 text-lg font-bold text-slate-950">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </article>

        <article className="premium-card p-6">
          <div className="flex items-center gap-3">
            <div className="icon-shell h-12 w-12">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Top sources</p>
              <h2 className="text-2xl font-semibold text-slate-950">Most active documents</h2>
            </div>
          </div>

          {topDocuments.length === 0 ? (
            <div className="soft-card mt-6 p-5 text-sm leading-7 text-slate-500">
              No conversations yet. Once people start using the workspace, the busiest sources will
              show up here first.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {topDocuments.map((doc, index) => (
                <button
                  key={doc.document_id}
                  onClick={() => navigate(`/chat/${doc.document_id}`)}
                  className="soft-card flex w-full items-center gap-3 p-4 text-left transition hover:-translate-y-0.5"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-950">{doc.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {doc.conversations} conversation{doc.conversations !== 1 ? 's' : ''} · {doc.messages} messages
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="mt-6">
        <article className="premium-card p-6">
          <div className="section-intro">
            <span className="eyebrow">Recent threads</span>
            <h2 className="font-display text-3xl text-slate-950">Conversations people came back to</h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              The most recent threads stay visible here so it is easy to see what was discussed last.
            </p>
          </div>

          {recentConversations.length === 0 ? (
            <div className="soft-card mt-6 p-5 text-sm leading-7 text-slate-500">
              No recent conversations yet.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {recentConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => conversation.document_id && navigate(`/chat/${conversation.document_id}`)}
                  className="soft-card flex w-full items-center gap-3 p-4 text-left transition hover:-translate-y-0.5"
                >
                  <div className="icon-shell h-11 w-11 shrink-0">
                    <MessageSquareText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-950">{conversation.title}</p>
                    {conversation.last_message_preview ? (
                      <p className="mt-1 truncate text-xs text-slate-500">{conversation.last_message_preview}</p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">No preview available</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] font-medium text-slate-400">
                    {conversation.created_at
                      ? new Date(conversation.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })
                      : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  )
}
