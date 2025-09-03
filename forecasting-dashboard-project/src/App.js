import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Sliders, DollarSign, Package, BarChart2, TrendingUp, ChevronDown, ChevronRight, AlertCircle, Sparkles, ShoppingCart, AlertTriangle, LogIn, LogOut, Filter, Truck, Activity, Repeat } from 'lucide-react';

// --- Helper & Utility Functions ---

// Z-scores for common service levels
const SERVICE_LEVEL_Z = {
    90: 1.28, 95: 1.645, 98: 2.05, 99: 2.33
};

// --- Helper Components ---

const KPICard = ({ title, value, icon, unit = '', helpText }) => (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col justify-between relative group">
        <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-400">{title}</h3>
            {icon}
        </div>
        <div>
            <p className="text-3xl font-bold text-white mt-2">{unit}{value}</p>
        </div>
        {helpText && (
            <div className="absolute bottom-full mb-2 w-max p-2 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                {helpText}
            </div>
        )}
    </div>
);

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-gray-700 p-3 rounded-lg border border-gray-600 shadow-xl">
                <p className="label text-white font-bold">{`${label}`}</p>
                {payload.map((p, i) => (
                    <p key={i} style={{ color: p.color }}>
                        {`${p.name}: ${p.value.toLocaleString()}`}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const ScenarioControl = ({ label, value, onChange, min, max, step, unit='' }) => (
    <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <div className="flex items-center">
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={e => onChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
            <span className="ml-4 text-white font-semibold w-16 text-center">{value}{unit}</span>
        </div>
    </div>
);


// --- Main App Component ---

export default function App() {
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [apiKey, setApiKey] = useState('');
    const [clientId, setClientId] = useState('');
    const [sheetUrl, setSheetUrl] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [gapiLoaded, setGapiLoaded] = useState(false);
    const [gisLoaded, setGisLoaded] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const tokenClientRef = useRef(null);

    const [activeSKUs, setActiveSKUs] = useState([]);
    const [expandedCategories, setExpandedCategories] = useState({});

    // New feature states
    const [serviceLevel, setServiceLevel] = useState(98);
    const [leadTimeChange, setLeadTimeChange] = useState(0); // This is a % change
    const [vendorFilter, setVendorFilter] = useState('All');
    const [abcClassification, setAbcClassification] = useState({});
    
    // What-if scenario states
    const [demandChange, setDemandChange] = useState(0);

    // AI state (removed for now)
    
    // Load saved credentials
    useEffect(() => {
        const savedCreds = localStorage.getItem('forecastAiCredsV2');
        if (savedCreds) {
            const { apiKey, clientId, sheetUrl } = JSON.parse(savedCreds);
            setApiKey(apiKey); setClientId(clientId); setSheetUrl(sheetUrl); setRememberMe(true);
        }
    }, []);
    
    // Load Google API scripts
    useEffect(() => {
        const scriptGapi = document.createElement('script');
        scriptGapi.src = 'https://apis.google.com/js/api.js';
        scriptGapi.async = true; scriptGapi.defer = true;
        scriptGapi.onload = () => window.gapi.load('client', () => setGapiLoaded(true));
        document.body.appendChild(scriptGapi);

        const scriptGis = document.createElement('script');
        scriptGis.src = 'https://accounts.google.com/gsi/client';
        scriptGis.async = true; scriptGis.defer = true;
        scriptGis.onload = () => setGisLoaded(true);
        document.body.appendChild(scriptGis);

        return () => { document.body.removeChild(scriptGapi); document.body.removeChild(scriptGis); }
    }, []);

    const handleAuthClick = useCallback(() => {
        if (rememberMe) {
            localStorage.setItem('forecastAiCredsV2', JSON.stringify({ apiKey, clientId, sheetUrl }));
        } else {
            localStorage.removeItem('forecastAiCredsV2');
        }

        if (gapiLoaded && gisLoaded && clientId) {
            tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
                callback: async (resp) => {
                    if (resp.error) {
                        setError(`Authorization error: ${resp.error_description || 'Please try again.'}`); return;
                    }
                    setIsAuthorized(true);
                },
            });

            if (!window.gapi.client.getToken()) {
                tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
            } else {
                tokenClientRef.current.requestAccessToken({ prompt: '' });
            }
        }
    }, [gapiLoaded, gisLoaded, clientId, rememberMe, apiKey, sheetUrl]);
    
    const handleLogout = () => {
        localStorage.removeItem('forecastAiCredsV2');
        setIsAuthorized(false);
        setData([]);
        // Reset credentials to empty strings to truly log out
        setApiKey('');
        setClientId('');
        setSheetUrl('');
    };

    // Fetch and process data after authorization
    useEffect(() => {
        const fetchData = async () => {
            if (!isAuthorized || !sheetUrl || !apiKey) return;
            try {
                await window.gapi.client.init({ apiKey, discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'] });
                const spreadsheetIdMatch = sheetUrl.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                if (!spreadsheetIdMatch) { setError("Invalid Google Sheet URL format."); return; }
                const spreadsheetId = spreadsheetIdMatch[1];
                setIsLoading(true);
                const response = await window.gapi.client.sheets.spreadsheets.values.get({ spreadsheetId, range: 'Sheet1!A2:J' });
                const range = response.result;
                if (range.values && range.values.length > 0) {
                    const parsedData = range.values.map(row => ({
                        date: row[0], parentItem: row[1], sku: row[2],
                        unitsSold: parseInt(row[3]) || 0,
                        orderCount: parseInt(row[4]) || 0,
                        unitPrice: parseFloat(row[5]) || 0,
                        unitCost: parseFloat(row[6]) || 0,
                        vendor: row[7],
                        currentInventory: parseInt(row[8]) || 0,
                        leadTime: parseInt(row[9]) || 0,
                    }));
                    setData(parsedData);
                    setError(null);
                } else { setError("No data found in the spreadsheet. Make sure the tab is named 'Sheet1'."); }
            } catch (err) {
                setError("Error fetching data. Check permissions, URL, and ensure the tab is named 'Sheet1'."); console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [isAuthorized, sheetUrl, apiKey]);
    
    // Perform ABC Analysis
    useEffect(() => {
        if (data.length === 0) return;
        const salesBySKU = data.reduce((acc, d) => {
            acc[d.sku] = (acc[d.sku] || 0) + d.unitsSold;
            return acc;
        }, {});

        const sortedSKUs = Object.entries(salesBySKU).sort(([, a], [, b]) => b - a);
        const totalSales = sortedSKUs.reduce((sum, [, sales]) => sum + sales, 0);
        if (totalSales === 0) return;

        let cumulativeSales = 0;
        const classification = {};
        sortedSKUs.forEach(([sku, sales]) => {
            cumulativeSales += sales;
            const percentage = cumulativeSales / totalSales;
            if (percentage <= 0.8) {
                classification[sku] = 'A';
            } else if (percentage <= 0.95) {
                classification[sku] = 'B';
            } else {
                classification[sku] = 'C';
            }
        });
        setAbcClassification(classification);
    }, [data]);
    
    // Core calculation engine
    const processedData = useMemo(() => {
        if (data.length === 0 || activeSKUs.length === 0) return null;

        const results = {};

        activeSKUs.forEach(sku => {
            const skuData = data.filter(d => d.sku === sku).sort((a,b) => new Date(a.date) - new Date(b.date));
            if (skuData.length < 2) return;

            const dailySales = skuData.map(d => d.unitsSold);
            const avgDailySales = dailySales.reduce((sum, val) => sum + val, 0) / dailySales.length;
            const variance = dailySales.reduce((sum, val) => sum + Math.pow(val - avgDailySales, 2), 0) / (dailySales.length - 1);
            const stdDevDailySales = Math.sqrt(variance);

            const baseLeadTime = skuData[0].leadTime;
            const adjustedLeadTime = Math.round(baseLeadTime * (1 + leadTimeChange / 100));
            const Z = SERVICE_LEVEL_Z[serviceLevel] || 2.05;

            const safetyStock = Math.round(Z * stdDevDailySales * Math.sqrt(adjustedLeadTime));
            const reorderPoint = Math.round((avgDailySales * adjustedLeadTime) + safetyStock);
            
            const reviewPeriod = 30;
            const maxStock = Math.round(reorderPoint + (avgDailySales * reviewPeriod));
            
            const currentInventory = skuData[skuData.length - 1].currentInventory;
            let purchaseRecommendation = 0;
            if (currentInventory <= reorderPoint) {
                purchaseRecommendation = maxStock - currentInventory;
            }

            const forecast = [];
            let projectedInventory = currentInventory;
            const inventoryProjectionData = [{ date: 'Today', inventory: currentInventory }];
            for (let i = 1; i <= 120; i++) {
                const forecastDate = new Date();
                forecastDate.setDate(forecastDate.getDate() + i);
                const forecastedUnits = Math.max(0, Math.round(avgDailySales * (1 + demandChange / 100)));
                forecast.push({ date: forecastDate.toISOString().split('T')[0], 'Forecasted Units': forecastedUnits });
                
                projectedInventory -= forecastedUnits;
                if (i === adjustedLeadTime && purchaseRecommendation > 0) {
                    projectedInventory += purchaseRecommendation;
                }
                inventoryProjectionData.push({ date: forecastDate.toISOString().split('T')[0], inventory: Math.round(projectedInventory) });
            }
            
            const annualDemand = avgDailySales * 365;
            const avgInventoryLevel = (maxStock + safetyStock) / 2;
            const inventoryTurns = avgInventoryLevel > 0 ? (annualDemand * skuData[0].unitCost) / (avgInventoryLevel * skuData[0].unitCost) : 0;
            
            results[sku] = {
                safetyStock, reorderPoint, maxStock, purchaseRecommendation,
                forecast, inventoryProjectionData, inventoryTurns,
                vendor: skuData[0].vendor,
                unitCost: skuData[0].unitCost,
                unitPrice: skuData[0].unitPrice
            };
        });
        
        return results;
    }, [data, activeSKUs, serviceLevel, leadTimeChange, demandChange]);
    
    const skuList = useMemo(() => {
        const categories = data.reduce((acc, item) => {
            if (!acc[item.parentItem]) acc[item.parentItem] = new Set();
            acc[item.parentItem].add(item.sku);
            return acc;
        }, {});
        return Object.keys(categories).sort().reduce((acc, key) => {
            acc[key] = Array.from(categories[key]).sort();
            return acc;
        }, {});
    }, [data]);

    const vendorList = useMemo(() => ['All', ...Array.from(new Set(data.map(d => d.vendor)))], [data]);

    const filteredPurchaseRecommendations = useMemo(() => {
        if (!processedData) return [];
        return Object.entries(processedData)
            .filter(([sku, metrics]) => 
                metrics.purchaseRecommendation > 0 && (vendorFilter === 'All' || metrics.vendor === vendorFilter)
            )
            .map(([sku, metrics]) => ({ sku, ...metrics }));
    }, [processedData, vendorFilter]);
    
    const aggregatedInventoryProjection = useMemo(() => {
        if (!processedData) return [];
        const combined = {};
        Object.values(processedData).forEach(skuMetrics => {
            skuMetrics.inventoryProjectionData.forEach(day => {
                if (!combined[day.date]) combined[day.date] = { date: day.date, inventory: 0 };
                combined[day.date].inventory += day.inventory;
            });
        });
        // Sort by date to ensure the chart is correct
        return Object.values(combined).sort((a, b) => {
            if (a.date === 'Today') return -1;
            if (b.date === 'Today') return 1;
            return new Date(a.date) - new Date(b.date);
        });
    }, [processedData]);

    const toggleSKU = (sku) => {
        setActiveSKUs(prev => prev.includes(sku) ? prev.filter(s => s !== sku) : [...prev, sku]);
    };

    const toggleCategory = (category) => {
        setExpandedCategories(prev => ({...prev, [category]: !prev[category]}));
    };

    if (!isAuthorized) {
        return (
            <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center font-sans">
                <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md">
                    <div className="flex items-center justify-center mb-6">
                        <TrendingUp className="h-10 w-10 text-indigo-400" />
                        <h1 className="text-3xl font-bold ml-3">Inventory Planner</h1>
                    </div>
                    <p className="text-center text-gray-400 mb-8">Connect to your Google Sheet to begin.</p>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-gray-300">Google API Key</label>
                            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full mt-1 p-2 bg-gray-700 rounded-md border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-300">Google Client ID</label>
                            <input type="password" value={clientId} onChange={e => setClientId(e.target.value)} className="w-full mt-1 p-2 bg-gray-700 rounded-md border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-300">Google Sheet URL</label>
                            <input type="text" value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="w-full mt-1 p-2 bg-gray-700 rounded-md border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                    </div>
                    
                    <div className="flex items-center mt-4">
                        <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="h-4 w-4 bg-gray-700 border-gray-600 text-indigo-500 rounded focus:ring-indigo-500" />
                        <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-300">Remember Credentials</label>
                    </div>

                    <button onClick={handleAuthClick} disabled={!gapiLoaded || !gisLoaded || !apiKey || !clientId || !sheetUrl} className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                        <LogIn className="mr-2 h-5 w-5"/>
                        Connect & Authorize
                    </button>
                    {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}
                </div>
            </div>
        );
    }
    
    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans flex">
            <aside className="w-72 bg-gray-800 p-4 flex flex-col">
                <div className="flex items-center mb-6">
                    <TrendingUp className="h-8 w-8 text-indigo-400" />
                    <h1 className="text-xl font-bold ml-2">Inventory Planner</h1>
                </div>
                <div className="mb-4">
                    <div className="p-2 rounded-lg bg-green-900/50 text-center">
                        <p className="text-sm font-semibold text-green-300">Connected</p>
                    </div>
                </div>
                <div className="mb-4">
                    <label htmlFor="vendorFilter" className="text-sm font-semibold text-gray-400 mb-2 flex items-center">
                        <Filter className="mr-2 h-4 w-4" /> VENDOR FILTER
                    </label>
                    <select id="vendorFilter" value={vendorFilter} onChange={e => setVendorFilter(e.target.value)}
                        className="w-full p-2 bg-gray-700 rounded-md border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500">
                        {vendorList.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </div>
                <nav className="flex-grow overflow-y-auto">
                    <h2 className="text-sm font-semibold text-gray-400 mb-2">PRODUCTS (SKUs)</h2>
                    {Object.keys(skuList).map(category => (
                        <div key={category}>
                            <div onClick={() => toggleCategory(category)} className="flex items-center justify-between cursor-pointer p-2 rounded-md hover:bg-gray-700">
                                <span className="font-semibold">{category}</span>
                                {expandedCategories[category] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </div>
                            {expandedCategories[category] && (
                                <ul className="ml-4 mt-1">
                                    {skuList[category].map(sku => (
                                        <li key={sku} className="flex items-center justify-between p-1.5 rounded-md hover:bg-gray-600">
                                            <div className="flex items-center">
                                                <input type="checkbox" id={sku} checked={activeSKUs.includes(sku)} onChange={() => toggleSKU(sku)} className="form-checkbox h-4 w-4 bg-gray-700 border-gray-600 text-indigo-500 rounded focus:ring-indigo-500" />
                                                <label htmlFor={sku} className="ml-2 text-sm text-gray-300 cursor-pointer">{sku}</label>
                                            </div>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                abcClassification[sku] === 'A' ? 'bg-green-500 text-green-900' :
                                                abcClassification[sku] === 'B' ? 'bg-yellow-500 text-yellow-900' : 'bg-gray-500 text-gray-900'
                                            }`}>
                                                {abcClassification[sku]}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </nav>
                 <button onClick={handleLogout} className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition-colors">
                    <LogOut className="mr-2 h-4 w-4"/>
                    Log Out
                </button>
            </aside>
            <main className="flex-1 p-6 overflow-y-auto">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <KPICard title="Projected Revenue (120d)" value={
                        processedData ? 
                        (Object.values(processedData).reduce((totalRevenue, skuMetrics) => {
                            const dailyRevenue = (skuMetrics.forecast[0]?.['Forecasted Units'] || 0) * (skuMetrics.unitPrice || 0);
                            return totalRevenue + (dailyRevenue * 120);
                        }, 0) / 1000000).toFixed(1) + 'M'
                        : '0.0M'
                    } unit="$" icon={<DollarSign className="text-green-500"/>} helpText="Total forecasted revenue for selected SKUs over the next 120 days."/>
                    <KPICard title="Avg. Inventory Turns" value={processedData && activeSKUs.length > 0 ? (Object.values(processedData).reduce((s, m) => s+m.inventoryTurns, 0) / activeSKUs.length).toFixed(1) : 'N/A'} icon={<Repeat className="text-blue-500"/>} helpText="How many times inventory is sold and replaced over a year. Higher is better." />
                    <KPICard title="Total Purchase Value" value={(filteredPurchaseRecommendations.reduce((s,r) => s + (r.purchaseRecommendation * r.unitCost), 0) / 1000).toFixed(1) + 'k'} unit="$" icon={<Package className="text-yellow-500"/>} helpText="Total cost of recommended purchases for the filtered vendor." />
                    <KPICard title="Items to Reorder" value={filteredPurchaseRecommendations.length} icon={<ShoppingCart className="text-red-500"/>} helpText="Number of SKUs for the filtered vendor that have fallen below their reorder point."/>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                            <h2 className="text-lg font-semibold mb-4">Projected Inventory Level (Units)</h2>
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={aggregatedInventoryProjection}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                                    <XAxis dataKey="date" stroke="#A0AEC0" tick={{ fontSize: 12 }} />
                                    <YAxis stroke="#A0AEC0" tick={{ fontSize: 12 }} domain={['auto', 'auto']}/>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="inventory" stroke="#8884d8" fillOpacity={0.5} fill="#8884d8" name="Projected Inventory"/>
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                            <h2 className="text-lg font-semibold mb-4 flex items-center"><Sliders className="mr-2"/> What-If Scenarios</h2>
                            <ScenarioControl label="Service Level" value={serviceLevel} onChange={setServiceLevel} min={90} max={99} step={1} unit="%"/>
                            <ScenarioControl label="Lead Time Change" value={leadTimeChange} onChange={setLeadTimeChange} min={-50} max={50} step={5} unit="%"/>
                            <ScenarioControl label="Demand Change" value={demandChange} onChange={setDemandChange} min={-50} max={50} step={5} unit="%"/>
                        </div>
                        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                             <h2 className="text-lg font-semibold mb-4 flex items-center">
                                <Activity className="mr-2 text-blue-400" /> Optimal Stock Levels
                            </h2>
                            <div className="space-y-3 max-h-60 overflow-y-auto">
                                {processedData && activeSKUs.length > 0 ? Object.entries(processedData).map(([sku, metrics]) => (
                                    <div key={sku} className="text-sm">
                                        <p className="font-bold text-gray-200">{sku}</p>
                                        <div className="grid grid-cols-3 gap-2 text-center mt-1">
                                            <div className="bg-gray-700 p-2 rounded">
                                                <p className="text-xs text-gray-400">Min (Reorder)</p>
                                                <p className="font-semibold text-white">{metrics.reorderPoint.toLocaleString()}</p>
                                            </div>
                                            <div className="bg-gray-700 p-2 rounded">
                                                <p className="text-xs text-gray-400">Max Stock</p>
                                                <p className="font-semibold text-white">{metrics.maxStock.toLocaleString()}</p>
                                            </div>
                                             <div className="bg-gray-700 p-2 rounded">
                                                <p className="text-xs text-gray-400">Safety Stock</p>
                                                <p className="font-semibold text-white">{metrics.safetyStock.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                )) : <p className="text-gray-400 text-center">Select an item to see its optimal stock levels.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

