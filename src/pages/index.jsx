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

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

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

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Register />} />
                
                
                <Route path="/Register" element={<Register />} />
                
                <Route path="/Login" element={<Login />} />
                
                <Route path="/Admin" element={<Admin />} />
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Investigation" element={<Investigation />} />
                
                <Route path="/InstagramSpy" element={<InstagramSpy />} />
                
                <Route path="/WhatsAppSpy" element={<WhatsAppSpy />} />
                
                <Route path="/BuyCredits" element={<BuyCredits />} />
                
                <Route path="/FacebookSpy" element={<FacebookSpy />} />
                
                <Route path="/FacebookSpyResults" element={<FacebookSpyResults />} />
                
                <Route path="/SMSSpy" element={<SMSSpy />} />
                
                <Route path="/CallsSpy" element={<CallsSpy />} />
                
                <Route path="/CameraSpy" element={<CameraSpy />} />
                
                <Route path="/LocationSpy" element={<LocationSpy />} />
                
                <Route path="/Profile" element={<Profile />} />
                
                <Route path="/Levels" element={<Levels />} />
                
                <Route path="/DetectiveSpy" element={<DetectiveSpy />} />
                
                <Route path="/CallsSpyResults" element={<CallsSpyResults />} />
                
                <Route path="/OtherNetworksSpy" element={<OtherNetworksSpy />} />
                
                <Route path="/HelpCenter" element={<HelpCenter />} />
                
                <Route path="/InstagramSpyResults" element={<InstagramSpyResults />} />
                
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