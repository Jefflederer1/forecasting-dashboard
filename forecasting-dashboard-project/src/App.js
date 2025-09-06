import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Sliders, DollarSign, Package, TrendingUp, ChevronDown, ChevronRight, LogIn, LogOut, Filter, Activity, Repeat, ShoppingCart } from 'lucide-react';

// --- Helper & Utility Functions ---
const SERVICE_LEVEL_Z = { 90: 1.28, 95: 1.645, 98: 2.05, 99: 2.33 };

// NEW: Robust parsing functions for data cleaning
const robustParseFloat = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 0;
    // Remove currency symbols, commas, and trim whitespace
    const cleaned = value.replace(/[^0-9.-]+/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
};
const robustParseInt = (value) => {
    if (typeof value === 'number') return Math.round(value);
    if (typeof value !== 'string') return 0;
    // Remove commas and trim whitespace
    const cleaned = value.replace(/[^0-9-]+/g, "");
    const num = parseInt(cleaned, 10);
    return isNaN(num) ? 0 : num;
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
                    <p key={i} style={{ color: p.color }}>{`${p.name}: ${p.value.toLocaleString()}`}</p>
                ))}
            </div>
        );
    }
    return null;
};

const ScenarioControl = ({ label, value, onChange, min, max, step, unit = '' }) => (
    <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <div className="flex items-center">
            <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={e => onChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />
            <span className="ml-4 text-white font-semibold w-16 text-center">{value}{unit}</span>
        </div>
    </div>
);

// --- Main App Component ---
export default function App() {
    // State declarations
    const [data, setData] = useState([]);
    const [error, setError] = useState(null);
    const [apiKey, setApiKey] = useState('');
    const [clientId, setClientId] = useState('');
    const [sheetUrl, setSheetUrl] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [authClientReady, setAuthClientReady] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [activeSKUs, setActiveSKUs] = useState([]);
    const [expandedCategories, setExpandedCategories] = useState({});
    const [serviceLevel, setServiceLevel] = useState(98);
    const [leadTimeChange, setLeadTimeChange] = useState(0);
    const [vendorFilter, setVendorFilter] = useState('All');
    const [abcClassification, setAbcClassification] = useState({});
    const [demandChange, setDemandChange] = useState(0);
    const tokenClient = useRef(null);

    // NEW: script readiness flags
    const [gapiReady, setGapiReady] = useState(false);
    const [gisReady, setGisReady] = useState(false);

    // Load saved credentials
    useEffect(() => {
        const savedCreds = localStorage.getItem('forecastAiCredsV2');
        if (savedCreds) {
            const { apiKey, clientId, sheetUrl } = JSON.parse(savedCreds);
            setApiKey(apiKey); setClientId(clientId); setSheetUrl(sheetUrl); setRememberMe(true);
        }
    }, []);

    // NEW SEQUENTIAL SCRIPT LOADING with ids + flags (avoids double injection / race)
    useEffect(() => {
        if (!document.getElementById('gapi-script')) {
            const scriptGapi = document.createElement('script');
            scriptGapi.id = 'gapi-script';
            scriptGapi.src = 'https://apis.google.com/js/api.js';
            scriptGapi.async = true;
            scriptGapi.defer = true;
            scriptGapi.onload = () => {
                window.gapi.load('client', () => setGapiReady(true));
            };
            document.body.appendChild(scriptGapi);
        } else if (window.gapi?.client) {
            setGapiReady(true);
        }

        if (!document.getElementById('gis-script')) {
            const scriptGis = document.createElement('script');
            scriptGis.id = 'gis-script';
            scriptGis.src = 'https://accounts.google.com/gsi/client';
            scriptGis.async = true;
            scriptGis.defer = true;
            scriptGis.onload = () => setGisReady(true);
            document.body.appendChild(scriptGis);
        } else if (window.google?.accounts?.oauth2) {
            setGisReady(true);
        }
    }, []);

    // Initialize auth client once scripts are ready AND creds exist
    useEffect(() => {
        if (!gapiReady || !gisReady || !clientId || !apiKey) {
            setAuthClientReady(false);
            return;
        }
        try {
            tokenClient.current = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId.trim(),
                scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
                callback: async (tokenResponse) => {
                    if (tokenResponse.error) {
                        setError(`Authorization Error: ${tokenResponse.error_description || tokenResponse.error}`);
                        setIsAuthorized(false);
                        return;
                    }
                    try {
                        await window.gapi.client.init({ apiKey, discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'] });
                        setIsAuthorized(true);
                    } catch (initErr) {
                        setError('API Initialization Error: Check your API Key.');
                    }
                },
            });
            setAuthClientReady(true);
        } catch (err) {
            setError('Authentication Client Error: Check your Client ID.');
            setAuthClientReady(false);
        }
    }, [gapiReady, gisReady, clientId, apiKey]);

    const handleAuthClick = useCallback(() => {
        setError(null);
        if (rememberMe) {
            localStorage.setItem('forecastAiCredsV2', JSON.stringify({ apiKey, clientId, sheetUrl }));
        } else {
            localStorage.removeItem('forecastAiCredsV2');
        }

        if (authClientReady && tokenClient.current) {
            tokenClient.current.requestAccessToken({ prompt: 'consent' });
        } else {
            setError('Authentication client not ready. Please wait or check credentials.');
        }
    }, [rememberMe, apiKey, clientId, sheetUrl, authClientReady]);
    
      const handleClientIdChange = (e) => {
          let value = e.target.value;
          const spaceIndex = value.indexOf(' ');
          if (spaceIndex !== -1) {
              value = value.substring(0, spaceIndex);
          }
          setClientId(value.trim());
      };

    const handleLogout = () => {
        localStorage.removeItem('forecastAiCredsV2');
        setIsAuthorized(false);
        setData([]);
        setApiKey('');
        setClientId('');
        setSheetUrl('');
    };

    // Fetch and process data after authorization with robust parsing and error handling
    useEffect(() => {
        const fetchData = async () => {
            if (!isAuthorized || !sheetUrl) return;
            try {
                const spreadsheetIdMatch = sheetUrl.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                if (!spreadsheetIdMatch) { 
                    setError("Invalid Google Sheet URL format."); 
                    return; 
                }
                const spreadsheetId = spreadsheetIdMatch[1];
                const response = await window.gapi.client.sheets.spreadsheets.values.get({ spreadsheetId, range: 'Sheet1!A:J' });
                const { result } = response;

                if (!result.values || result.values.length < 2) {
                    setError("No data found in Sheet1. Ensure data starts on row 2.");
                    return;
                }
                
                const header = result.values[0].map(h => h.trim());
                const expectedHeader = ['date', 'parentItem', 'sku', 'unitsSold', 'orderCount', 'unitPrice', 'unitCost', 'vendor', 'currentInventory', 'leadTime'];
                
                if (JSON.stringify(header) !== JSON.stringify(expectedHeader)) {
                    setError(`Header mismatch. Expected: ${expectedHeader.join(', ')}. Found: ${header.join(', ')}`);
                    return;
                }

                const parsedData = result.values.slice(1).map((row, index) => {
                    const rowNum = index + 2;
                    if (row.length === 0 || row.every(cell => !cell)) return null; // Skip empty rows
                    try {
                        return {
                            date: row[0] || '',
                            parentItem: row[1] || '',
                            sku: row[2] || '',
                            unitsSold: robustParseInt(row[3]),
                            orderCount: robustParseInt(row[4]),
                            unitPrice: robustParseFloat(row[5]),
                            unitCost: robustParseFloat(row[6]),
                            vendor: row[7] || '',
                            currentInventory: robustParseInt(row[8]),
                            leadTime: robustParseInt(row[9]),
                        };
                    } catch(parseError) {
                        // This will now provide a specific error message to the user
                        throw new Error(`Data format error in row ${rowNum}. Please check the numeric columns.`);
                    }
                }).filter(Boolean); // Filter out any skipped empty rows
                
                setData(parsedData);
                setError(null);

            } catch (err) {
                // Display the actual error from Google's API if available
                const apiError = err.result?.error?.message;
                setError(apiError || err.message || "Fetch Error. Check sheet permissions and URL.");
                console.error(err);
            }
        };
        fetchData();
    }, [isAuthorized, sheetUrl]);
    
    // Perform ABC Analysis
    useEffect(() => {
        if (data.length === 0) return;
        const salesBySKU = data.reduce((acc, d) => {
            if(d.sku) acc[d.sku] = (acc[d.sku] || 0) + d.unitsSold;
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
            const skuData = data.filter(d => d.sku === sku && d.date).sort((a,b) => new Date(a.date) - new Date(b.date));
            if (skuData.length < 2) return;
            const dailySales = skuData.map(d => d.unitsSold);
            const avgDailySales = dailySales.reduce((sum, val) => sum + val, 0) / dailySales.length;
            const variance = dailySales.length > 1 ? dailySales.reduce((sum, val) => sum + Math.pow(val - avgDailySales, 2), 0) / (dailySales.length - 1) : 0;
            const stdDevDailySales = Math.sqrt(variance) || 0;
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
            const avgInventoryValue = ((maxStock + safetyStock) / 2) * skuData[0].unitCost;
            const annualCOGS = annualDemand * skuData[0].unitCost;
            const inventoryTurns = avgInventoryValue > 0 ? annualCOGS / avgInventoryValue : 0;
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
    
    // Memoized selectors for UI
    const skuList = useMemo(() => {
        const categories = data.reduce((acc, item) => {
            if(item.parentItem && item.sku) {
                if (!acc[item.parentItem]) acc[item.parentItem] = new Set();
                acc[item.parentItem].add(item.sku);
            }
            return acc;
        }, {});
        return Object.keys(categories).sort().reduce((acc, key) => {
            acc[key] = Array.from(categories[key]).sort();
            return acc;
        }, {});
    }, [data]);

    const vendorList = useMemo(() => ['All', ...Array.from(new Set(data.map(d => d.vendor).filter(Boolean)))], [data]);

    const filteredPurchaseRecommendations = useMemo(() => {
        if (!processedData) return [];
        return Object.entries(processedData)
            .filter(([, metrics]) =>
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
        return Object.values(combined).sort((a, b) => {
            if (a.date === 'Today') return -1;
            if (b.date === 'Today') return 1;
            return new Date(a.date) - new Date(b.date);
        });
    }, [processedData]);

    const kpiValues = useMemo(() => {
        if (!processedData) return { revenue: '0.0M', turns: 'N/A', purchaseValue: '0.0k', reorderItems: 0 };

        const totalRevenue = Object.values(processedData).reduce((total, skuMetrics) => {
            const dailySales = skuMetrics.forecast.length > 0 ? skuMetrics.forecast[0]['Forecasted Units'] : 0;
            const dailyRevenue = dailySales * skuMetrics.unitPrice;
            return total + (dailyRevenue * 120);
        }, 0);

        const activeSKUsCount = Object.keys(processedData).length;
        const avgTurns = activeSKUsCount > 0 ? Object.values(processedData).reduce((sum, m) => sum + m.inventoryTurns, 0) / activeSKUsCount : 0;
        
        const purchaseValue = filteredPurchaseRecommendations.reduce((sum, r) => sum + (r.purchaseRecommendation * r.unitCost), 0);

        return {
            revenue: `$${(totalRevenue / 1000000).toFixed(1)}M`,
            turns: isNaN(avgTurns) ? 'N/A' : avgTurns.toFixed(1),
            purchaseValue: `$${(purchaseValue / 1000).toFixed(1)}k`,
            reorderItems: filteredPurchaseRecommendations.length
        };
    }, [processedData, filteredPurchaseRecommendations]);


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
                            <label htmlFor="apiKey" className="text-sm font-medium text-gray-300">Google API Key</label>
                            <input type="password" id="apiKey" name="apiKey" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full mt-1 p-2 bg-gray-700 rounded-md border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        <div>
                            <label htmlFor="clientId" className="text-sm font-medium text-gray-300">Google Client ID</label>
                            <input type="password" id="clientId" name="clientId" value={clientId} onChange={handleClientIdChange} className="w-full mt-1 p-2 bg-gray-700 rounded-md border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        <div>
                            <label htmlFor="sheetUrl" className="text-sm font-medium text-gray-300">Google Sheet URL</label>
                            <input type="text" id="sheetUrl" name="sheetUrl" value={sheetUrl} onChange={e => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="w-full mt-1 p-2 bg-gray-700 rounded-md border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                    </div>
                    
                    <div className="flex items-center mt-4">
                        <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="h-4 w-4 bg-gray-700 border-gray-600 text-indigo-500 rounded focus:ring-indigo-500" />
                        <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-300">Remember Credentials</label>
                    </div>
                    
                    <button
                        onClick={handleAuthClick}
                        disabled={!authClientReady || !sheetUrl || !apiKey || !clientId}
                        className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                        <LogIn className="mr-2 h-5 w-5"/>
                        Connect & Authorize
                    </button>
                    {/* NEW: More specific error display */}
                    {error && 
                        <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
                            <p className="text-red-300 text-sm font-semibold text-center">{error}</p>
                        </div>
                    }
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
                    <select id="vendorFilter" name="vendorFilter" value={vendorFilter} onChange={e => setVendorFilter(e.target.value)}
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
                    <KPICard title="Projected Revenue (120d)" value={kpiValues.revenue} icon={<DollarSign className="text-green-500"/>} helpText="Total forecasted revenue for selected SKUs over the next 120 days."/>
                    <KPICard title="Avg. Inventory Turns" value={kpiValues.turns} icon={<Repeat className="text-blue-500"/>} helpText="How many times inventory is sold and replaced over a year. Higher is better." />
                    <KPICard title="Total Purchase Value" value={kpiValues.purchaseValue} icon={<Package className="text-yellow-500"/>} helpText="Total cost of recommended purchases for the filtered vendor." />
                    <KPICard title="Items to Reorder" value={kpiValues.reorderItems} icon={<ShoppingCart className="text-red-500"/>} helpText="Number of SKUs for the filtered vendor that have fallen below their reorder point."/>
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

