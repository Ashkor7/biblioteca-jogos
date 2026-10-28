import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from './services/queryClient.js';
import AuthProvider from './components/AuthProvider.jsx';
import ToastProvider from './components/ToastProvider.jsx';
import Layout from './components/Layout.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import { LoadingState } from './components/States.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const PlatformPage = lazy(() => import('./pages/PlatformPage.jsx'));
const WishlistPage = lazy(() => import('./pages/WishlistPage.jsx'));
const StatisticsPage = lazy(() => import('./pages/StatisticsPage.jsx'));
const GameFormPage = lazy(() => import('./pages/GameFormPage.jsx'));
const GameDetailsPage = lazy(() => import('./pages/GameDetailsPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const ImportPage = lazy(() => import('./pages/ImportPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));

const queryClient = createQueryClient();

const page = (el) => <Suspense fallback={<LoadingState />}>{el}</Suspense>;
const read = (el) => <RequireAuth mode="read">{page(el)}</RequireAuth>;
const write = (el) => <RequireAuth mode="write">{page(el)}</RequireAuth>;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={read(<Dashboard />)} />
                {/* Rota dinâmica única para TODAS as plataformas */}
                <Route path="plataformas/:slug" element={read(<PlatformPage />)} />
                <Route path="desejos" element={read(<WishlistPage />)} />
                <Route path="estatisticas" element={read(<StatisticsPage />)} />
                <Route path="jogos/novo" element={write(<GameFormPage />)} />
                <Route path="jogos/:id" element={read(<GameDetailsPage />)} />
                <Route path="jogos/:id/editar" element={write(<GameFormPage />)} />
                <Route path="importar" element={write(<ImportPage />)} />
                <Route path="login" element={page(<LoginPage />)} />
                <Route path="*" element={page(<NotFoundPage />)} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
