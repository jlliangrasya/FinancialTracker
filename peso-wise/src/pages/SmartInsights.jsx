import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getTransactions } from '../firebase/transactions'
import { getBudgets } from '../firebase/budgets'
import { getBills } from '../firebase/bills'
import { generateInsights } from '../engine/insightsEngine'
import { getMonthLabel } from '../utils/dateHelpers'
import { getPreviousMonthLabel } from '../engine/rollover'
import InsightCard from '../components/InsightCard'
import styles from './SmartInsights.module.css'

export default function SmartInsights() {
  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets] = useState([])
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const { currentUser } = useAuth()
  const monthLabel = getMonthLabel()
  const prevMonthLabel = getPreviousMonthLabel(monthLabel)

  useEffect(() => {
    async function load() {
      if (!currentUser) return; setLoading(true)
      try {
        const [t, b, bl] = await Promise.all([getTransactions(currentUser.uid), getBudgets(currentUser.uid), getBills(currentUser.uid)])
        setTransactions(t); setBudgets(b); setBills(bl)
      } catch (err) { console.error(err) }
      setLoading(false)
    }
    load()
  }, [currentUser])

  const filterByMonth = (txns, label) => txns.filter(t => {
    const d = t.date?.toDate ? t.date.toDate() : new Date(t.date)
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return months[d.getMonth()] + '-' + d.getFullYear() === label
  })

  const insights = useMemo(() => {
    const current = filterByMonth(transactions, monthLabel)
    const prev = filterByMonth(transactions, prevMonthLabel)
    return generateInsights(current, prev, budgets, bills)
  }, [transactions, budgets, bills, monthLabel, prevMonthLabel])

  if (loading) return <div className={styles.container}><h1 className={styles.title}>Smart Insights</h1>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 70, borderRadius: 10, marginBottom: 12 }} />)}</div>

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Smart Insights</h1>
      {insights.length > 0 ? (
        <div className={styles.insightList}>
          {insights.map((ins, i) => <InsightCard key={i} type={ins.type} headline={ins.headline} detail={ins.detail} tip={ins.tip} />)}
        </div>
      ) : (
        <div className={styles.empty}><div className={styles.emptyIcon}>💡</div><p>No insights yet. Keep logging transactions and insights will appear here.</p></div>
      )}
    </div>
  )
}
