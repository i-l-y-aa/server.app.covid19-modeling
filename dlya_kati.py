import math
import numpy as np
import matplotlib.ticker as ticker
import matplotlib.pyplot as plt
import pylab as pl
import sciris as sc
import covasim as cv
import scipy as sp
import optuna as op
import pandas as pd
from datetime import datetime, date

import json
import matplotlib.dates as mdates

import random
import time

import multiprocessing
print(multiprocessing.cpu_count())

from functions_total import *  # all auxiliary functions


import warnings
warnings.filterwarnings("ignore")

import calibration_total as st
from calibration_total import model

import sys

# basic parameters for Novosibirsk
#print("!")
reg_num0 = sys.argv[2]
reg_num = int(reg_num0)
print(reg_num)


location = None
data_csv = None
state_url = None

#print(reg_num)
if reg_num == 1:
    location='Novosibirsk'
    state_url = 'https://ai-biolab.ru/data/novosibirsk-region-data.csv'
    data_csv="Novosibirsk.csv"
elif reg_num == 2:
    location='Omsk'
    state_url = 'https://ai-biolab.ru/data/omsk-region-data.csv'
    data_csv="Omsk.csv"
else :
    location='Altai'
    state_url = 'https://ai-biolab.ru/data/altay-region-data.csv'
    data_csv="Altai.csv"



print(location)
#location='Novosibirsk'
#pop_location=2798170
#pop_location=279817
#2 268 179 - алт край
#1 879 548[ - омск облатсь

pop_location2=sys.argv[1]
pop_location = int(pop_location2)
print(pop_location2)

cal_keys=['new_diagnoses']
cal_values=[1]

init_inf=sys.argv[4]
print(init_inf)
pop_inf=[init_inf,1,150] #число заболевших, 1 нижняя граница, 150 верхняя. - начальное кол зараженных, границы для поиска передаются алгоритму оптимизации
#без отрицательных значений и сильно большие не  надо ставить

#data_csv="Novosibirsk.csv"


# dates when schools were closed and opened (for clip_edges intervention)
school_days=['2020-03-18', '2020-09-01', '2020-10-24', '2021-01-11']
school_changes=[0, 1, 0, 0.5]


#state_url = './../www/ai-biolab.ru/data/novosibirsk-region-data-small.csv' #вернуть подключение с сайта
data = pd.read_csv(state_url, index_col="date", parse_dates=True, na_values=['nan'])
#data['new_diagnoses'][-3] = 178

state_data = data.sort_values(by=['date'])
data.to_csv(data_csv)

df1=pd.read_csv(data_csv,index_col=0,parse_dates=True)

# fill unknown tests
df1.new_tests=past_extr(df=df1,series=df1.new_tests,n=df1['new_tests'].isna().sum())
df1=smooth_pd(df1)
df1['date']=df1.index

# define start day and last day, bounds_of_periods for calibration
start_day=cv.date(df1.index[0].to_pydatetime().date())
last_day=cv.date(df1.index[-1].to_pydatetime().date())
bounds_of_periods=bounds_of_per(start_day,last_day)
bounds_of_periods.append(cv.date(last_day, as_date=False))

def smooth_results(results_file, stats):
    d={}
    for s in stats:
        d[s.split('_')[1]+'_low'] = smooth(results_file.results[s].low)
        d[s.split('_')[1]+'_high'] = smooth(results_file.results[s].high)
        d[s.split('_')[1]+'_val'] = smooth(results_file.results[s].values)
    return d

# In[4]:


dt=datetime.today()
day_today = cv.date(date(dt.year, dt.month, dt.day),as_date=False)
calibrated_params=open('params_08_04_2022.json','r')
p=json.load(calibrated_params)
print(day_today)
# define beta_changes and beta_days from calibrated parameters in list 'p'
b_days=[]
b_changes=[]
for i in range(len(p)):
    b_days.append(p[i][f'beta_day_{i+1}'])
    b_changes.append(p[i][f'beta_change_{i+1}'])
b_days=list(map(int, b_days))


# dates of beta_change
b_change_model=cv.date(b_days,start_date=start_day, as_date=False)


# In[ ]:

n_future0 = sys.argv[3]
n_future=int(n_future0)
print(n_future)
#n_future=45 # на сколько дней вперед делать прогноз

forecast=future_extr(filename=data_csv, end_day=last_day, n_future=n_future)

forecast=pd.Series(smooth(forecast),index=[df1.index[-1] + timedelta(days=i) for i in range(1, n_future+2)])
forecast.name ='new_tests'
forecast = forecast.to_frame()

forecast_data=pd.concat([df1,forecast])
forecast_data['date']=forecast_data.index

# define parameters for prognose
n_runs=3
save=True
namesim=f'prognose_{day_today}_{location}.sim'
plot=False
#to_plot=['new_diagnoses','new_deaths','new_recoveries','new_severe','new_critical']
to_plot=['new_diagnoses']
now_data = sys.argv[5]
jsonnamemsim=f'users_msim_res_{reg_num}_{pop_location}_{init_inf}_{n_future}_{now_data}.json' ####
print(now_data)
print(jsonnamemsim)
# do prognose
prognose(forecast_data=forecast_data, start_day=start_day, location=location, pop_location=pop_location, p=p,
         to_plot=to_plot, b_days=b_days, b_changes=b_changes, school_days=school_days,
         school_changes=school_changes, n_runs=n_runs, save=save, namemsim=namesim, plot=plot, jsonnamemsim=jsonnamemsim) #последний параметр
