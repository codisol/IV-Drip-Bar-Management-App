import { useState } from 'react';
import { formatDate, formatDateTime } from '../utils/dateFormatter';
import { Transaction } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

interface FinancialReportsProps {
  transactions: Transaction[];
}

export function FinancialReports({ transactions }: FinancialReportsProps) {
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [showDateFilter, setShowDateFilter] = useState(false);

  const setTodayFilter = () => {
    const today = new Date().toISOString().split('T')[0];
    setDateFilter({ start: today, end: today });
    setShowDateFilter(true);
  };

  const filteredTransactions = transactions.filter(t => {
    if (!showDateFilter) return true;
    const transDate = new Date(t.time).toISOString().split('T')[0];
    if (dateFilter.start && transDate < dateFilter.start) return false;
    if (dateFilter.end && transDate > dateFilter.end) return false;
    return true;
  }).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const totalIncome = filteredTransactions
    .filter(t => t.status === 'Paid')
    .reduce((sum, t) => sum + t.totalPayment, 0);

  const pendingIncome = filteredTransactions
    .filter(t => t.status === 'On Progress')
    .reduce((sum, t) => sum + t.totalPayment, 0);

  // Prepare chart data - group by date
  const chartData = filteredTransactions.reduce((acc, transaction) => {
    const date = formatDate(transaction.time);
    const existing = acc.find(item => item.date === date);

    if (existing) {
      if (transaction.status === 'Paid') {
        existing.paid += transaction.totalPayment;
      } else {
        existing.pending += transaction.totalPayment;
      }
      existing.total += transaction.totalPayment;
    } else {
      acc.push({
        date,
        paid: transaction.status === 'Paid' ? transaction.totalPayment : 0,
        pending: transaction.status === 'On Progress' ? transaction.totalPayment : 0,
        total: transaction.totalPayment
      });
    }

    return acc;
  }, [] as Array<{ date: string; paid: number; pending: number; total: number }>);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Paid Income</CardDescription>
            <CardTitle className="text-green-600">Rp {totalIncome.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              <span className="text-gray-600">Completed transactions</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Pending Income</CardDescription>
            <CardTitle className="text-orange-600">Rp {pendingIncome.toLocaleString()}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              <span className="text-gray-600">On progress</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Transactions</CardDescription>
            <CardTitle className="text-gray-900">{filteredTransactions.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">In selected period</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Income Chart</CardTitle>
          <CardDescription>Daily income breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => `Rp ${Number(value).toLocaleString()}`} />
                <Legend />
                <Bar dataKey="paid" fill="#10b981" name="Paid" />
                <Bar dataKey="pending" fill="#f59e0b" name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500 py-8">No data available</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Income Trend</CardTitle>
          <CardDescription>Total daily income</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => `Rp ${Number(value).toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} name="Total Income" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-gray-500 py-8">No data available</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>Detailed income records</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={setTodayFilter}>
                <Calendar className="w-4 h-4 mr-2" />
                Today
              </Button>
              <Input
                type="date"
                placeholder="Start Date"
                value={dateFilter.start}
                onChange={(e) => {
                  setDateFilter({ ...dateFilter, start: e.target.value });
                  setShowDateFilter(true);
                }}
                className="w-40"
              />
              <Input
                type="date"
                placeholder="End Date"
                value={dateFilter.end}
                onChange={(e) => {
                  setDateFilter({ ...dateFilter, end: e.target.value });
                  setShowDateFilter(true);
                }}
                className="w-40"
              />
              {showDateFilter && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setDateFilter({ start: '', end: '' });
                  setShowDateFilter(false);
                }}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-white">
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="text-xs">{new Date(transaction.time).toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-xs">{transaction.id}</TableCell>
                        <TableCell>{transaction.patientName}</TableCell>
                        <TableCell className="font-medium">Rp {transaction.totalPayment.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={transaction.status === 'Paid' ? 'default' : 'secondary'}>
                            {transaction.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
