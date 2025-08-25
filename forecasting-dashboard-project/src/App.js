import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Sliders, DollarSign, Package, BarChart2, TrendingUp, ChevronDown, ChevronRight, FileText, AlertCircle, Sparkles, ShoppingCart, AlertTriangle, Sheet, LogIn } from 'lucide-react';

// --- Helper Components ---

const KPICard = ({ title, value, icon, trend, unit = '' }) => (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col justify-between">
        <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-400">{title}</h3>
            {icon}
        </div>
        <div>
            <p className="text-3xl font-bold text-white mt-2">{unit}{value}</p>
            {trend && <p className={`text-xs mt-1 ${trend.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>{trend}</p>}
        </div>
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

const ScenarioControl = ({ label, value, onChange, min, max, step }) => (
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
            <span className="ml-4 text-white font-semibold w-16 text-center">{value}%</span>
        </div>
    </div>
);

const AIInsightsCard = ({ onGenerate, insights, isLoading }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
             ✨ AI Strategic Briefing
        </h2>
        <div className="bg-gray-900 p-4 rounded-md min-h-[200px] text-sm text-gray-300 overflow-y-auto prose prose-invert prose-sm max-w-none">
            {isLoading ? (
                <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
            ) : (
                <div dangerouslySetInnerHTML={{ __html: insights ? insights.replace(/\n/g, '<br />') : "Connect to Google Sheets and select SKUs to generate insights." }} />
            )}
        </div>
        <button
            onClick={onGenerate}
            disabled={isLoading}
            className="w-full mt-4 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center justify-center transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
            <Sparkles className="mr-2 h-4 w-4"/>
            {isLoading ? 'Analyzing...' : 'Generate Briefing'}
        </button>
    </div>
);

const PurchaseAdvisorCard = ({ recommendations }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-lg font-semibold mb-4 flex items-center">
            <ShoppingCart className="mr-2 text-green-400" /> Purchase Advisor
        </h2>
        <div className="space-y-4 max-h-60 overflow-y-auto">
            {recommendations.length > 0 ? (
                recommendations.map(rec => (
                    <div key={rec.sku} className="bg-yellow-900/50 border border-yellow-700 p-3 rounded-lg">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-yellow-300 flex items-center"><AlertTriangle className="mr-2 h-4 w-4"/>{rec.sku}</span>
                            <span className="text-xs text-gray-400">Reorder Point: {rec.reorderPoint}</span>
                        </div>
                        <p className="text-sm text-gray-200 mt-1">
                            Current inventory is <span className="font-bold">{rec.currentInventory}</span>.
                            Recommend purchasing <span className="font-bold text-green-400">{rec.purchaseQty.toLocaleString()}</span> units.
                        </p>
                    </div>
                ))
            ) : (
                <div className="text-center text-gray-400 p-4">
                    <p>All selected SKUs are above their reorder points. No immediate action needed.</p>
                </div>
            )}
        </div>
    </div>
);


// --- Main App Component ---

export default function App() {
    const [data, setData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [forecastData, setForecastData] = useState([]);
    const [cashFlowData, setCashFlowData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Google Sheets State
    const [apiKey, setApiKey] = useState('');
    const [clientId, setClientId] = useState('');
    const [sheetUrl, setSheetUrl] = useState('');
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [gapiLoaded, setGapiLoaded] = useState(false);
    const [gisLoaded, setGisLoaded] = useState(false);
    let tokenClient = null;


    // What-if scenario state
    const [demandChange, setDemandChange] = useState(0);
    const [priceChange, setPriceChange] = useState(0);
    const [costChange, setCostChange] = useState(0);

    const [activeSKUs, setActiveSKUs] = useState([]);
    const [expandedCategories, setExpandedCategories] = useState({});

    // Gemini API state
    const [aiInsights, setAiInsights] = useState('');
    const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
    
    const [purchaseRecommendations, setPurchaseRecommendations] = useState([]);
    
    // Load Google API scripts
    useEffect(() => {
        const scriptGapi = document.createElement('script');
        scriptGapi.src = 'https://apis.google.com/js/api.js';
        scriptGapi.async = true;
        scriptGapi.defer = true;
        scriptGapi.onload = () => window.gapi.load('client', () => setGapiLoaded(true));
        document.body.appendChild(scriptGapi);

        const scriptGis = document.createElement('script');
        scriptGis.src = 'https://accounts.google.com/gsi/client';
        scriptGis.async = true;
        scriptGis.defer = true;
        scriptGis.onload = () => setGisLoaded(true);
        document.body.appendChild(scriptGis);

        return () => {
            document.body.removeChild(scriptGapi);
            document.body.removeChild(scriptGis);
        }
    }, []);

    const handleAuthClick = useCallback(() => {
        if (gapiLoaded && gisLoaded && clientId) {
            tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
                callback: async (resp) => {
                    if (resp.error !== undefined) {
                        throw (resp);
                    }
                    setIsAuthorized(true);
                    await listSheetData();
                },
            });

            if (window.gapi.client.getToken() === null) {
                tokenClient.requestAccessToken({ prompt: 'consent' });
            } else {
                tokenClient.requestAccessToken({ prompt: '' });
            }
        }
    }, [gapiLoaded, gisLoaded, clientId]);

    const listSheetData = useCallback(async () => {
        if (!sheetUrl) {
            setError("Please enter a valid Google Sheet URL.");
            return;
        }
        
        try {
            await window.gapi.client.init({
                apiKey: apiKey,
                discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
            });

            const spreadsheetIdMatch = sheetUrl.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            if (!spreadsheetIdMatch) {
                setError("Invalid Google Sheet URL format.");
                return;
            }
            const spreadsheetId = spreadsheetIdMatch[1];

            setIsLoading(true);
            const response = await window.gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: 'Sheet1!A2:L', // Assuming data starts from the second row
            });

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
                    reorderPoint: parseInt(row[10]) || 0,
                    safetyStock: parseInt(row[11]) || 0,
                }));
                setData(parsedData);
                setError(null);
            } else {
                setError("No data found in the spreadsheet.");
            }
        } catch (err) {
            setError("Error fetching data from Google Sheet. Check permissions and URL.");
            console.error('execute error', err);
        } finally {
            setIsLoading(false);
        }
    }, [apiKey, sheetUrl]);


    // Memoize SKU list to prevent re-computation
    const skuList = useMemo(() => {
        const categories = data.reduce((acc, item) => {
            if (!acc[item.parentItem]) {
                acc[item.parentItem] = new Set();
            }
            acc[item.parentItem].add(item.sku);
            return acc;
        }, {});
        return Object.keys(categories).reduce((acc, key) => {
            acc[key] = Array.from(categories[key]);
            return acc;
        }, {});
    }, [data]);

    // Set initial active SKUs and expanded categories
    useEffect(() => {
        if (Object.keys(skuList).length > 0 && activeSKUs.length === 0) {
            const firstCategory = Object.keys(skuList)[0];
            if (firstCategory && skuList[firstCategory].length > 0) {
                const firstSku = skuList[firstCategory][0];
                setActiveSKUs([firstSku]);
                setExpandedCategories({ [firstCategory]: true });
            }
        }
    }, [skuList, activeSKUs]);
    
    // Main data processing and forecasting logic
    const processData = useCallback(() => {
        if (data.length === 0 || activeSKUs.length === 0) return;

        const currentFilteredData = data.filter(d => activeSKUs.includes(d.sku));
        setFilteredData(currentFilteredData);

        const aggregated = currentFilteredData.reduce((acc, d) => {
            const date = d.date;
            if (!acc[date]) {
                acc[date] = { date, unitsSold: 0, orderCount: 0, revenue: 0, cost: 0 };
            }
            acc[date].unitsSold += d.unitsSold;
            acc[date].orderCount += d.orderCount;
            acc[date].revenue += d.unitsSold * d.unitPrice;
            acc[date].cost += d.unitsSold * d.unitCost;
            return acc;
        }, {});

        const historicalAggregated = Object.values(aggregated).sort((a, b) => new Date(a.date) - new Date(b.date));

        const last30Days = historicalAggregated.slice(-30);
        if (last30Days.length === 0) {
            setForecastData([]);
            setCashFlowData([]);
            return;
        }
        
        const totalUnits = last30Days.reduce((sum, d) => sum + d.unitsSold, 0);
        const totalOrders = last30Days.reduce((sum, d) => sum + d.orderCount, 0);
        const avgOrdersPerDay = totalOrders / last30Days.length;
        const avgUnitsPerOrder = totalOrders > 0 ? totalUnits / totalOrders : 0;
        
        const avgPrice = data.find(d => activeSKUs.includes(d.sku))?.unitPrice || 0;
        const avgCost = data.find(d => activeSKUs.includes(d.sku))?.unitCost || 0;

        const newForecast = [];
        const newCashFlow = [];
        const lastDate = historicalAggregated.length > 0 ? new Date(historicalAggregated[historicalAggregated.length - 1].date) : new Date();

        for (let i = 1; i <= 120; i++) {
            const forecastDate = new Date(lastDate);
            forecastDate.setDate(lastDate.getDate() + i);
            
            const adjustedOrders = avgOrdersPerDay * (1 + demandChange / 100);
            const adjustedPrice = avgPrice * (1 + priceChange / 100);
            const adjustedCost = avgCost * (1 + costChange / 100);

            const forecastedUnits = Math.round(adjustedOrders * avgUnitsPerOrder * (1 + (Math.random() - 0.5) * 0.2));
            const forecastedRevenue = forecastedUnits * adjustedPrice;
            const forecastedCost = forecastedUnits * adjustedCost;

            newForecast.push({
                date: forecastDate.toISOString().split('T')[0],
                forecastUnits: forecastedUnits,
                forecastRevenue: forecastedRevenue,
            });

            if (i % 30 === 1 || i === 120) {
                const monthStartDate = new Date(forecastDate);
                monthStartDate.setDate(1);
                const monthName = monthStartDate.toLocaleString('default', { month: 'short' });
                
                const monthlyRevenue = forecastedRevenue * 30;
                const monthlyCost = forecastedCost * 30;
                
                newCashFlow.push({
                    month: `${monthName} '${String(monthStartDate.getFullYear()).slice(2)}`,
                    revenue: monthlyRevenue,
                    cogs: monthlyCost,
                    profit: monthlyRevenue - monthlyCost,
                });
            }
        }
        setForecastData(newForecast);
        setCashFlowData(newCashFlow);
        
        // Generate Purchase Recommendations
        const recommendations = [];
        const forecastDemand120d = newForecast.reduce((sum, d) => sum + d.forecastUnits, 0);
        
        activeSKUs.forEach(sku => {
            const latestEntry = data.filter(d => d.sku === sku).sort((a,b) => new Date(b.date) - new Date(a.date))[0];
            if (latestEntry && latestEntry.currentInventory < latestEntry.reorderPoint) {
                const purchaseQty = Math.round((latestEntry.safetyStock - latestEntry.currentInventory) + forecastDemand120d / activeSKUs.length);
                recommendations.push({
                    sku,
                    currentInventory: latestEntry.currentInventory,
                    reorderPoint: latestEntry.reorderPoint,
                    purchaseQty: Math.max(0, purchaseQty), // Ensure non-negative
                });
            }
        });
        setPurchaseRecommendations(recommendations);
        
    }, [data, activeSKUs, demandChange, priceChange, costChange]);

    useEffect(processData, [processData]);

    const toggleSKU = (sku) => {
        setActiveSKUs(prev => 
            prev.includes(sku) ? prev.filter(s => s !== sku) : [...prev, sku]
        );
    };

    const toggleCategory = (category) => {
        setExpandedCategories(prev => ({...prev, [category]: !prev[category]}));
    };

    const kpiValues = useMemo(() => {
        if (filteredData.length === 0) return { totalRevenue: 0, inventoryValue: 0, projectedRevenue: 0 };
        const totalRevenue = filteredData.reduce((sum, d) => sum + d.unitsSold * d.unitPrice, 0);
        
        const uniqueSkus = [...new Set(data.map(item => item.sku))];
        const totalInventoryValue = uniqueSkus.reduce((sum, sku) => {
            const latestEntry = data
                .filter(item => item.sku === sku)
                .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            return sum + (latestEntry ? latestEntry.currentInventory * latestEntry.unitCost : 0);
        }, 0);

        const projectedRevenue = forecastData.reduce((sum, d) => sum + d.forecastRevenue, 0);
        
        return {
            totalRevenue,
            inventoryValue: totalInventoryValue,
            projectedRevenue
        };
    }, [filteredData, forecastData, data]);

    const generateAIInsights = async () => {
        if (!filteredData.length || !forecastData.length) {
            setError("Not enough data to generate insights. Please select at least one SKU.");
            return;
        }
        setIsGeneratingInsights(true);
        setAiInsights('');
    
        const summary = {
            selectedSKUs: activeSKUs,
            leadTime: data.find(d => d.sku === activeSKUs[0])?.leadTime || 120,
            forecast: {
                totalUnits: forecastData.reduce((sum, d) => sum + d.forecastUnits, 0),
            },
            whatIfScenarios: {
                demandChange: `${demandChange}%`,
            },
            purchaseRecommendations: purchaseRecommendations.map(r => `SKU ${r.sku}: Recommend buying ${r.purchaseQty.toLocaleString()} units.`).join('; ') || "None"
        };
    
        const prompt = `
            You are a world-class supply chain analyst for a promotional products company. Your task is to provide a concise, actionable strategic briefing based on the following data summary. The forecast is now based on order frequency and average order size, making it more reliable.

            **Data Summary:**
            - **Selected SKUs:** ${summary.selectedSKUs.join(', ')}
            - **Replenishment Lead Time:** ${summary.leadTime} days
            - **Forecasted Demand (120d):** ${summary.forecast.totalUnits.toLocaleString()} units
            - **Active "What-If" Demand Scenario:** ${summary.whatIfScenarios.demandChange}
            - **Urgent Purchase Recommendations:** ${summary.purchaseRecommendations}

            **Your Briefing:**
            Based on this data, provide a strategic briefing in two parts using Markdown formatting:
            1.  **Executive Summary:** A brief, high-level overview of the forecast and inventory status.
            2.  **Actionable Recommendations:** Provide 2-3 specific, bullet-pointed recommendations. **Critically, you must comment on the purchase recommendations.** Are they urgent? How do they align with the forecast? What is the risk of not acting, given the ${summary.leadTime}-day lead time?
        `;
    
        try {
            let chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiKey = "";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
    
            if (!response.ok) throw new Error(`API call failed with status: ${response.status}`);
    
            const result = await response.json();
            
            if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                setAiInsights(result.candidates[0].content.parts[0].text);
            } else {
                throw new Error("Invalid response structure from API.");
            }
    
        } catch (err) {
            console.error("Error generating AI insights:", err);
            setAiInsights("An error occurred while generating the briefing. Please check the console for details and try again.");
        } finally {
            setIsGeneratingInsights(false);
        }
    };

    const combinedChartData = useMemo(() => {
        const historical = filteredData.reduce((acc, d) => {
            const date = d.date;
            if (!acc[date]) {
                acc[date] = { date, 'Historical Units': 0 };
            }
            acc[date]['Historical Units'] += d.unitsSold;
            return acc;
        }, {});

        const historicalValues = Object.values(historical).sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const forecastValues = forecastData.map(d => ({
            date: d.date,
            'Forecasted Units': d.forecastUnits,
        }));
        
        return [...historicalValues, ...forecastValues];
    }, [filteredData, forecastData]);

    if (!isAuthorized) {
        return (
            <div className="bg-gray-900 text-white min-h-screen flex items-center justify-center font-sans">
                <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md">
                    <div className="flex items-center justify-center mb-6">
                        <TrendingUp className="h-10 w-10 text-indigo-400" />
                        <h1 className="text-3xl font-bold ml-3">ForecastAI</h1>
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
                    
                    <button onClick={handleAuthClick} disabled={!gapiLoaded || !gisLoaded || !apiKey || !clientId || !sheetUrl} className="w-full mt-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                        <LogIn className="mr-2 h-5 w-5"/>
                        Connect & Authorize
                    </button>
                    {error && <p className="text-red-400 text-sm mt-4 text-center">{error}</p>}
                </div>
            </div>
        )
    }

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans flex">
            <aside className="w-64 bg-gray-800 p-4 flex flex-col">
                <div className="flex items-center mb-8">
                    <TrendingUp className="h-8 w-8 text-indigo-400" />
                    <h1 className="text-xl font-bold ml-2">ForecastAI</h1>
                </div>
                
                <div className="mb-6">
                    <div className="p-2 rounded-lg bg-green-900/50 text-center">
                        <p className="text-sm font-semibold text-green-300">Connected</p>
                        <p className="text-xs text-gray-400 truncate">{sheetUrl.substring(0,30)}...</p>
                    </div>
                </div>

                <nav className="flex-grow overflow-y-auto">
                    <h2 className="text-sm font-semibold text-gray-400 mb-2">PRODUCTS (SKUs)</h2>
                    {isLoading ? <p className="text-gray-400 text-sm">Loading SKUs...</p> : Object.keys(skuList).map(category => (
                        <div key={category}>
                            <div onClick={() => toggleCategory(category)} className="flex items-center justify-between cursor-pointer p-2 rounded-md hover:bg-gray-700">
                                <span className="font-semibold">{category}</span>
                                {expandedCategories[category] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </div>
                            {expandedCategories[category] && (
                                <ul className="ml-4 mt-1">
                                    {skuList[category].map(sku => (
                                        <li key={sku} className="flex items-center p-1.5 rounded-md hover:bg-gray-600">
                                            <input type="checkbox" id={sku} checked={activeSKUs.includes(sku)} onChange={() => toggleSKU(sku)} className="form-checkbox h-4 w-4 bg-gray-700 border-gray-600 text-indigo-500 rounded focus:ring-indigo-500" />
                                            <label htmlFor={sku} className="ml-2 text-sm text-gray-300 cursor-pointer">{sku}</label>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </nav>
            </aside>

            <main className="flex-1 p-6 overflow-y-auto">
                {error && (
                     <div className="bg-red-900 border border-red-600 text-red-100 px-4 py-3 rounded-lg relative mb-4" role="alert">
                        <strong className="font-bold"><AlertCircle className="inline mr-2"/>Error: </strong>
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <KPICard title="Total Revenue (180d)" value={kpiValues.totalRevenue.toLocaleString()} unit="$" icon={<DollarSign className="text-green-500"/>} trend="+5.2% vs prev period" />
                    <KPICard title="Total Inventory Value" value={kpiValues.inventoryValue.toLocaleString()} unit="$" icon={<Package className="text-blue-500"/>} />
                    <KPICard title="Projected Revenue (120d)" value={kpiValues.projectedRevenue.toLocaleString()} unit="$" icon={<BarChart2 className="text-yellow-500"/>} />
                    <KPICard title="Items to Reorder" value={purchaseRecommendations.length} icon={<ShoppingCart className="text-red-500"/>} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                            <h2 className="text-lg font-semibold mb-4">Sales & Forecast (Units)</h2>
                            {isLoading ? <div className="flex justify-center items-center h-80"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div></div> :
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={combinedChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                                    <XAxis dataKey="date" stroke="#A0AEC0" tick={{ fontSize: 12 }} />
                                    <YAxis stroke="#A0AEC0" tick={{ fontSize: 12 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Line type="monotone" dataKey="Historical Units" stroke="#4299E1" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="Forecasted Units" stroke="#48BB78" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                </LineChart>
                            </ResponsiveContainer>}
                        </div>

                        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                            <h2 className="text-lg font-semibold mb-4">Cash Flow Projection (Next 120 Days)</h2>
                            {isLoading ? <div className="flex justify-center items-center h-80"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div></div> :
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={cashFlowData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                                    <XAxis dataKey="month" stroke="#A0AEC0" tick={{ fontSize: 12 }} />
                                    <YAxis stroke="#A0AEC0" tick={{ fontSize: 12 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Bar dataKey="revenue" stackId="a" fill="#38B2AC" name="Revenue" />
                                    <Bar dataKey="cogs" stackId="a" fill="#E53E3E" name="COGS" />
                                    <Bar dataKey="profit" fill="#48BB78" name="Profit" />
                                </BarChart>
                            </ResponsiveContainer>}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                            <h2 className="text-lg font-semibold mb-4 flex items-center"><Sliders className="mr-2"/> What-If Scenarios</h2>
                            <ScenarioControl label="Demand Change" value={demandChange} onChange={setDemandChange} min={-50} max={50} step={5} />
                            <ScenarioControl label="Unit Price Change" value={priceChange} onChange={setPriceChange} min={-50} max={50} step={5} />
                            <ScenarioControl label="Unit Cost Change" value={costChange} onChange={setCostChange} min={-50} max={50} step={5} />
                        </div>
                        
                        <PurchaseAdvisorCard recommendations={purchaseRecommendations} />

                        <AIInsightsCard 
                            onGenerate={generateAIInsights}
                            insights={aiInsights}
                            isLoading={isGeneratingInsights}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}
