import requests
import csv
import os
import pandas as pd

import pickle as p
import json

url = "https://covid19-modeling.ru/data/COVID19_forecasts.p"
filename="COVID19_forecasts.p"

r=requests.get(url, allow_redirects=True)
open(filename, "wb").write(r.content)

with open('COVID19_forecasts.p', "rb") as fh:
  df = p.load(fh)
print("r")
kk = []
kk = df.keys()

for key in df.keys():
  print(key)
  x = df[key]['res_mod_pred']
  x=x.to_csv(header = False)
  with open(f"./parsingCOVID_files/{key}_res_mod_pred.txt", "w") as file:
    file.write(x)
  y = df[key]['res_mod_train']
  y=y.to_csv()
  with open(f"./parsingCOVID_files/{key}_res_mod_train.txt", "w") as file:
    file.write(y)
  z = df[key]['res_mod_true']
  z=z.to_csv()
  with open(f"./parsingCOVID_files/{key}_res_mod_true.txt", "w") as file:
    file.write(z)

for key in df.keys():
  x = df[key]['res_mod_pred']
  x=x.to_csv(header = False)
  with open(f"./parsingCOVID_files/{key}_res_mod_pred.txt", 'rb') as file:
    data = file.read()
  with open(f"./parsingCOVID_files/{key}_res_mod_pred_.txt", 'wb') as final:
    final.writelines(['Date,S_mean,S_max,S_min,E_mean,E_max,E_min,I_mean,I_max,I_min,R_mean,R_max,R_min,H_mean,H_max,H_min,C_mean,C_max,C_min,D_mean,D_max,D_min,fk_mean,fk_max,fk_min,R0_mean,R0_max,R0_min,alpha_e_mean,alpha_e_std,alpha_i_mean,alpha_i_std,eps_hc_mean,eps_hc_std,mu_mean,mu_std'.encode()])
    final.write("\n".encode())
    final.write(data)

for key in df.keys():
  read_file = pd.read_csv (f"./parsingCOVID_files/{key}_res_mod_pred_.txt")
  read_file.to_csv (f"./parsingCOVID_files/{key}_res_mod_pred.csv", index=None)
  read_file2 = pd.read_csv (f"./parsingCOVID_files/{key}_res_mod_train.txt")
  read_file2.to_csv (f"./parsingCOVID_files/{key}_res_mod_train.csv", index=None)
  read_file3 = pd.read_csv (f"./parsingCOVID_files/{key}_res_mod_true.txt")
  read_file3.to_csv (f"./parsingCOVID_files/{key}_res_mod_true.csv", index=None)

combined_csv = pd.concat([read_file3,read_file ])

for key in df.keys():
  os.remove(f"./parsingCOVID_files/{key}_res_mod_pred_.txt")
  os.remove(f"./parsingCOVID_files/{key}_res_mod_pred.txt")
  os.remove(f"./parsingCOVID_files/{key}_res_mod_train.txt")
  os.remove(f"./parsingCOVID_files/{key}_res_mod_true.txt")

Dates = {}
Dates['dates'] = []
for key in df.keys():
    Dates['dates'].append({'data': key.strftime("%Y-%m-%d")})

with open(f"./parsingCOVID_files/dates.json", 'w') as outfile:
    json.dump(Dates, outfile)
