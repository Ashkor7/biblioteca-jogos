import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from './services/queryClient.js';
import AuthProvider from './components/AuthProvider.jsx';
import ToastProvider from './components/ToastProvider.jsx';
import Layout from './components/Layout.jsx';
import PublicLayout from './components/PublicLayout.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import { LoadingState } from './components/States.jsx';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const LibraryPage = lazy(() => import('./pages/LibraryPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const ProfilePreviewPage = lazy(() => import('./pages/ProfilePreviewPage.jsx'));
const DiaryPage = lazy(() => import('./pages/DiaryPage.jsx'));
const CollectionsPage = lazy(() => import('./pages/CollectionsPage.jsx'));
const CollectionPage = lazy(() => import('./pages/CollectionPage.jsx'));
const AchievementsPage = lazy(() => import('./pages/AchievementsPage.jsx'));
const GoalsPage = lazy(() => import('./pages/GoalsPage.jsx'));
const ActivitiesPage = lazy(() => import('./pages/ActivitiesPage.jsx'));
const PlatformPage = lazy(() => import('./pages/PlatformPage.jsx'));
const WishlistPage = lazy(() => import('./pages/WishlistPage.jsx'));
const StatisticsPage = lazy(() => import('./pages/StatisticsPage.jsx'));
const GameFormPage = lazy(() => import('./pages/GameFormPage.jsx'));
const GameDetailsPage = lazy(() => import('./pages/GameDetailsPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const ImportPage = lazy(() => import('./pages/ImportPage.jsx'));
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage.jsx'));
const PublicCollectionPage = lazy(() => import('./pages/PublicCollectionPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));

const queryClient = createQueryClient();

const page = (el) => <Suspense fallback={<LoadingState />}>{el}</Suspense>;
const owner = (el) => <RequireAuth>{page(el)}</RequireAuth>;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Perfil público: somente leitura, sem menu administrativo */}
              <Route path="u/:username" element={<PublicLayout />}>
                <Route index element={page(<PublicProfilePage />)} />
                <Route path="colecoes/:id" element={page(<PublicCollectionPage />)} />
              </Route>
              <Route element={<Layout />}>
                <Route index element={owner(<Dashboard />)} />
                <Route path="perfil" element={owner(<ProfilePage />)} />
                <Route path="biblioteca" element={owner(<LibraryPage />)} />
                {/* Rota dinâmica única para TODAS as plataformas */}
                <Route path="plataformas/:slug" element={owner(<PlatformPage />)} />
                <Route path="desejos" element={owner(<WishlistPage />)} />
                <Route path="diario" element={owner(<DiaryPage />)} />
                <Route path="colecoes" element={owner(<CollectionsPage />)} />
                <Route path="colecoes/:id" element={owner(<CollectionPage />)} />
                <Route path="conquistas" element={owner(<AchievementsPage />)} />
                <Route path="metas" element={owner(<GoalsPage />)} />
                <Route path="atividades" element={owner(<ActivitiesPage />)} />
                <Route path="estatisticas" element={owner(<StatisticsPage />)} />
                <Route path="configuracoes" element={owner(<SettingsPage />)} />
                <Route path="configuracoes/previa" element={owner(<ProfilePreviewPage />)} />
                <Route path="jogos/novo" element={owner(<GameFormPage />)} />
                <Route path="jogos/:id" element={owner(<GameDetailsPage />)} />
                <Route path="jogos/:id/editar" element={owner(<GameFormPage />)} />
                <Route path="importar" element={owner(<ImportPage />)} />
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
