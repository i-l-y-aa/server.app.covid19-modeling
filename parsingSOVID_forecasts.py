print("HEllo")

import csv

import numpy as np
import pandas as pd
import pickle
print("okey")
import pickle5 as p
print("okey")

import sys


with open('../www/covid19-modeling.ru/SEIR_HCD/SOVID19_forecasts.p', "rb") as fh:
  df = p.load(fh)

for key in df.keys():
  print(key)
  x = df[key]['res_mod_pred']
  x=x.to_csv()
  with open(f"./parsingSOVID_files/{key}_res_mod_pred.txt", "w") as file:
    file.write(x)
  y = df[key]['res_mod_train']
  y=y.to_csv()
  with open(f"./parsingSOVID_files/{key}_res_mod_train.txt", "w") as file:
    file.write(y)
  z = df[key]['res_mod_true']
  z=z.to_csv()
  with open(f"./parsingSOVID_files/{key}_res_mod_true.txt", "w") as file:
    file.write(z)
