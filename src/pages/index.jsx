import React from 'react';
import Layout from "./Layout.jsx";

import Register from "./Register";

import Login from "./Login";

import Admin from "./Admin";

import Dashboard from "./Dashboard";

import Investigation from "./Investigation";

import InstagramSpy from "./InstagramSpy";

import WhatsAppSpy from "./WhatsAppSpy";

import BuyCredits from "./BuyCredits";

import FacebookSpy from "./FacebookSpy";

import FacebookSpyResults from "./FacebookSpyResults";

import SMSSpy from "./SMSSpy";

import SMSSpyChat from "./SMSSpyChat";

import CallsSpy from "./CallsSpy";

import CameraSpy from "./CameraSpy";

import LocationSpy from "./LocationSpy";

import Profile from "./Profile";

import Levels from "./Levels";

import DetectiveSpy from "./DetectiveSpy";

import CallsSpyResults from "./CallsSpyResults";

import OtherNetworksSpy from "./OtherNetworksSpy";

import HelpCenter from "./HelpCenter";

import InstagramSpyResults from "./InstagramSpyResults";

import { BrowserRouter as Router, Route, Routes, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { ProtectedRoute } from "@/components/ProtectedRoute";

const PAGES = {
    
    Register: Register,
    
    Login: Login,
    
    Admin: Admin,
    
    Dashboard: Dashboard,
    
    Investigation: Investigation,
    
    InstagramSpy: InstagramSpy,
    
    WhatsAppSpy: WhatsAppSpy,
    
    BuyCredits: BuyCredits,
    
    FacebookSpy: FacebookSpy,
    
    FacebookSpyResults: FacebookSpyResults,
    
    SMSSpy: SMSSpy,
    
    SMSSpyChat: SMSSpyChat,
    
    CallsSpy: CallsSpy,
    
    CameraSpy: CameraSpy,
    
    LocationSpy: LocationSpy,
    
    Profile: Profile,
    
    Levels: Levels,
    
    DetectiveSpy: DetectiveSpy,
    
    CallsSpyResults: CallsSpyResults,
    
    OtherNetworksSpy: OtherNetworksSpy,
    
    HelpCenter: HelpCenter,
    
    InstagramSpyResults: InstagramSpyResults,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Componente 404 que volta para a página anterior
function NotFound() {
    const navigate = useNavigate();
    
    React.useEffect(() => {
        // Voltar para a página anterior automaticamente
        navigate(-1);
    }, [navigate]);
    
    return null;
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                {/* Rotas públicas */}
                    <Route path="/" element={<Register />} />
                <Route path="/Register" element={<Register />} />
                <Route path="/Login" element={<Login />} />
                
                {/* Rotas protegidas - requerem autenticação */}
                <Route path="/Admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                <Route path="/Dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/Investigation" element={<ProtectedRoute><Investigation /></ProtectedRoute>} />
                <Route path="/InstagramSpy" element={<ProtectedRoute><InstagramSpy /></ProtectedRoute>} />
                <Route path="/WhatsAppSpy" element={<ProtectedRoute><WhatsAppSpy /></ProtectedRoute>} />
                <Route path="/BuyCredits" element={<ProtectedRoute><BuyCredits /></ProtectedRoute>} />
                <Route path="/FacebookSpy" element={<ProtectedRoute><FacebookSpy /></ProtectedRoute>} />
                <Route path="/FacebookSpyResults" element={<ProtectedRoute><FacebookSpyResults /></ProtectedRoute>} />
                <Route path="/SMSSpy" element={<ProtectedRoute><SMSSpy /></ProtectedRoute>} />
                <Route path="/SMSSpyChat" element={<ProtectedRoute><SMSSpyChat /></ProtectedRoute>} />
                <Route path="/CallsSpy" element={<ProtectedRoute><CallsSpy /></ProtectedRoute>} />
                <Route path="/CameraSpy" element={<ProtectedRoute><CameraSpy /></ProtectedRoute>} />
                <Route path="/LocationSpy" element={<ProtectedRoute><LocationSpy /></ProtectedRoute>} />
                <Route path="/Profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/Levels" element={<ProtectedRoute><Levels /></ProtectedRoute>} />
                <Route path="/DetectiveSpy" element={<ProtectedRoute><DetectiveSpy /></ProtectedRoute>} />
                <Route path="/CallsSpyResults" element={<ProtectedRoute><CallsSpyResults /></ProtectedRoute>} />
                <Route path="/OtherNetworksSpy" element={<ProtectedRoute><OtherNetworksSpy /></ProtectedRoute>} />
                <Route path="/HelpCenter" element={<ProtectedRoute><HelpCenter /></ProtectedRoute>} />
                <Route path="/InstagramSpyResults" element={<ProtectedRoute><InstagramSpyResults /></ProtectedRoute>} />
                
                {/* Rota 404 - voltar para página anterior */}
                <Route path="*" element={<NotFound />} />
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}